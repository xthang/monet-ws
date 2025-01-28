import { $Enums, type Prisma } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import { FREE_PLAN_MAX_GROUP_MEMBERS } from '@/constants/env'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { WsError, WsErrorCode, WsHttpCode } from '@/types/error'
import type { WsMessageFullPayload } from '@/types/ws/message'
import { Ws_GroupMembers_Upsert_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_GroupMembers_Upsert_Receipt } from '@/types/ws/response'
import { findUniqueAccountOrThrow, findUniqueGroupMembershipOrThrow } from '@/utils/db/queries'
import { ACCOUNT_SELECT, MEMBER_SELECT_WHERE } from '@/utils/db/query-constants'
import { transformPhoneNoToDbAlias } from '@/utils/db/transform/account-alias'
import { fromDbLocale } from '@/utils/db/transform/locale'
import { validateEmailAddr } from '@/utils/email-address'
import getNotificationRecipientInfoFromMembership from '@/utils/notify/get-notification-recipient-info-from-membership'
import notifyUpdatedGroupMembers from '@/utils/notify/group-membership/notify-updated-group-members'
import { parsePhoneNo } from '@/utils/phone-number'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleUpsertGroupMembers(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_GroupMembers_Upsert_RequestData
) {
  // Validate inputs
  const input = Ws_GroupMembers_Upsert_RequestData.parse(rawInput)

  const { accountId, orgId, otherAccountInfo } = ws.auth
  const {
    groupId,
    data: { members },
    isUpdateOrder
  } = input

  try {
    // check permission
    const membership = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      include: {
        group: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: { deletedAt: null, deletedBy: null, isActive: true },
              select: MEMBER_SELECT_WHERE
            }
          }
        }
      }
    })

    const { memberships: memberships_, ...group } = membership.group
    const memberships = memberships_.filter((m) => m.account ?? m.accountAlias ?? m.accountPlaceholder)
    const memberDict = Object.fromEntries(memberships.map(({ id, ...m }) => [id, m]))

    // Check member permission
    const hasAdmin = memberships.some((m) => m.role === $Enums.GroupMemberRole.admin)
    const iAmTheOnlyAdmin =
      membership.role === $Enums.GroupMemberRole.admin &&
      memberships.filter((m) => m.role === $Enums.GroupMemberRole.admin).length <= 1

    if (members.creates?.length) {
      const hasProGroupAdmin =
        hasAdmin &&
        memberships.some(
          (m) =>
            m.role === $Enums.GroupMemberRole.admin &&
            m.account?.subscriptionPlan &&
            m.account.subscriptionEndedAt! > new Date()
        )

      if (memberships.length >= FREE_PLAN_MAX_GROUP_MEMBERS && !hasProGroupAdmin) {
        throw new WsError(
          WsHttpCode.BAD_REQUEST,
          WsErrorCode.GROUP_MEMBERS_MAXIMUM_REACHED,
          'Maximum group members reached'
        )
      }
    }

    if (members.updates?.some((it) => it.role !== undefined)) {
      if (hasAdmin && membership.role !== $Enums.GroupMemberRole.admin) {
        throw new WsError(WsHttpCode.FORBIDDEN, WsErrorCode.NOT_ALLOWED, 'Forbidden')
      }

      members.updates.forEach(({ id, role }) => {
        const {
          accountId: mAccountId,
          accountPlaceholderId: mAccountPlaceholderId,
          accountOrPlaceholderId: mAccountOrPlaceholderId,
          role: mRole
        } = memberDict[id]
        const isMe = id === membership.id || mAccountId === accountId || mAccountOrPlaceholderId === accountId

        if (role && mAccountPlaceholderId)
          throw new WsError(WsHttpCode.BAD_REQUEST, null, 'Can not set role for an account placeholder')

        if (role && role === mRole) throw new WsError(WsHttpCode.BAD_REQUEST, null, 'Member role is already ' + role)

        if (isMe && iAmTheOnlyAdmin && role === null)
          throw new WsError(WsHttpCode.BAD_REQUEST, null, 'You are currently the only admin')
      })
    }

    members.deletes?.forEach(({ id }) => {
      const { accountId: mAccountId, accountOrPlaceholderId: mAccountOrPlaceholderId, role: mRole } = memberDict[id]
      const isMe = id === membership.id || mAccountId === accountId || mAccountOrPlaceholderId === accountId

      if (isMe && iAmTheOnlyAdmin) throw new WsError(WsHttpCode.BAD_REQUEST, null, 'You are currently the only admin')

      if (!isMe) {
        if (mRole === $Enums.GroupMemberRole.admin && membership.role !== $Enums.GroupMemberRole.admin)
          throw new WsError(
            WsHttpCode.FORBIDDEN,
            WsErrorCode.NOT_ALLOWED,
            'You do not have permission to remove the group Admin'
          )

        if (mRole === $Enums.GroupMemberRole.mod && !membership.role)
          throw new WsError(
            WsHttpCode.FORBIDDEN,
            WsErrorCode.NOT_ALLOWED,
            'You do not have permission to remove the group Moderator'
          )
      }
    })

    return await db.$transaction(async (tx) => {
      const { creates, updates, deletes } = members
      let createds, updateds, deleteds

      const toSendNoti: {
        accountId?: string
        accountAliasId?: string
        name?: string
        locale?: SupportedLocale | null
        channel: 'email' | 'sms'
        address: string
        type: 'added' | 'removed'
      }[] = []

      if (creates || updates) {
        const membershipIds: ((
          | { role?: $Enums.GroupMemberRole; order: number }
          | { id: string; role?: $Enums.GroupMemberRole | null; nickname?: string | null; order?: number }
        ) & {
          accountId?: string
          accountAliasId?: string
          accountPlaceholderId?: string
        })[] = []

        // create Account Aliases/Placeholders
        for (const it of [...(creates ?? []), ...(updates ?? [])]) {
          if ('accountId' in it) {
            const { accountId, ...data } = it

            // Check if account is in the org
            if (orgId)
              await tx.organizationMembership.findUniqueOrThrow({
                where: { orgId_accountId_isActive: { orgId, accountId, isActive: true } }
              })

            membershipIds.push({ ...data, accountId })

            const acc = await findUniqueAccountOrThrow(db, accountId, {
              select: {
                accountAliases: { where: { verificationStatus: 'verified', deletedAt: null, isActive: true } }
              }
            })
            toSendNoti.push(
              ...getNotificationRecipientInfoFromMembership(
                { account: { ...acc, locale: acc.locale && (fromDbLocale(acc.locale) as SupportedLocale) } },
                locale
              ).map((it) => ({
                ...it,
                type: 'added' as const
              }))
            )
          } else if ('accountAlias' in it && it.accountAlias) {
            const { accountAlias, ...data } = it
            const { type, rawValue, value } = accountAlias

            // validate
            if (type === 'email-addr' && !validateEmailAddr(value))
              throw new WsError(WsHttpCode.BAD_REQUEST, null, 'invalid email address')
            else if (type === 'phone-no' && !parsePhoneNo(value.number))
              throw new WsError(WsHttpCode.BAD_REQUEST, null, 'invalid phone number')

            const alias = await tx.accountAlias.upsert({
              where: {
                type_contactValue_isActive: {
                  ...(type === 'email-addr'
                    ? { type: $Enums.AccountAliasType.emailAddr, contactValue: value }
                    : { type: $Enums.AccountAliasType.phoneNo, contactValue: value.number }),
                  isActive: true
                }
              },
              create: {
                ...(type === 'email-addr'
                  ? { type: $Enums.AccountAliasType.emailAddr, rawValue, contactValue: value }
                  : transformPhoneNoToDbAlias(rawValue, value)),
                isActive: true,
                createdBy: accountId
              },
              update: {
                ...(type === 'email-addr'
                  ? { type: $Enums.AccountAliasType.emailAddr, rawValue, contactValue: value }
                  : transformPhoneNoToDbAlias(rawValue, value)),
                updatedBy: accountId
              } // do not allow updating accountAlias if it already existed
            })

            // Check if account is in the org
            let validAccountId
            if (orgId && alias.accountId && alias.verificationStatus === 'verified') {
              const orgMembership = await tx.organizationMembership.findUnique({
                where: { orgId_accountId_isActive: { orgId, accountId: alias.accountId, isActive: true } }
              })
              if (orgMembership) validAccountId = orgMembership.accountId
            }

            membershipIds.push({ ...data, accountId: validAccountId, accountAliasId: alias.id })

            if (type === 'email-addr' || type === 'phone-no')
              toSendNoti.push({
                accountId: validAccountId,
                accountAliasId: alias.id,
                locale,
                channel: type === 'email-addr' ? 'email' : 'sms',
                address: type === 'email-addr' ? value : value.number,
                type: 'added'
              })
          } else if ('accountPlaceholder' in it && it.accountPlaceholder) {
            const { accountPlaceholder, ...data } = it
            const created = await tx.accountPlaceholder.create({
              data: { ...accountPlaceholder, createdBy: accountId }
            })
            membershipIds.push({ ...data, accountPlaceholderId: created.id })
          } else {
            membershipIds.push(it)
          }

          // TODO: delete unused Placeholders here or create a Cron job to delete all
        }

        const createIds = membershipIds.filter(
          (it): it is Exclude<(typeof membershipIds)[number], { id: string }> => !('id' in it)
        )
        const updateIds = membershipIds.filter(
          (it): it is Extract<(typeof membershipIds)[number], { id: string }> => 'id' in it
        )

        if (createIds.length) {
          createds = await tx.groupMembership.createMany({
            data: createIds.map<Prisma.GroupMembershipCreateManyInput>(
              ({ accountId: partakerAccountId, accountAliasId, accountPlaceholderId, role, order }) => ({
                groupId,
                accountId: partakerAccountId,
                accountAliasId,
                accountPlaceholderId,
                accountOrPlaceholderId: partakerAccountId ?? accountAliasId ?? accountPlaceholderId!,
                role: role ?? (partakerAccountId === accountId ? $Enums.GroupMemberRole.admin : null),
                addedByAccountId: accountId,
                order,
                createdBy: accountId
              })
            )
          })
        }

        if (updateIds.length) {
          updateds = []

          for (const {
            id: memberId,
            accountId: partakerAccountId,
            accountAliasId,
            accountPlaceholderId,
            role,
            order,
            nickname
          } of updateIds) {
            const accountOrPlaceholderId = partakerAccountId ?? accountAliasId ?? accountPlaceholderId
            const updated = await tx.groupMembership.update({
              where: {
                id: memberId,
                ...(isUpdateOrder && order != undefined ? undefined : { deletedAt: null, isActive: true })
              },
              data: {
                // if one of partakerAccountId | accountAliasId | accountPlaceholderId exists (meaning accountOrPlaceholderId is not empty), we update the others to null
                accountId: partakerAccountId ?? (accountOrPlaceholderId ? null : undefined),
                accountAliasId: accountAliasId ?? (accountOrPlaceholderId ? null : undefined),
                accountPlaceholderId: accountPlaceholderId ?? (accountOrPlaceholderId ? null : undefined),
                accountOrPlaceholderId,
                addedByAccountId: accountId,
                role,
                order,
                nickname: nickname === undefined ? undefined : nickname?.trim() || null,
                updatedBy: accountId
              }
            })
            updateds.push(updated)
          }
        }
      }

      let deleteMemberships
      if (deletes?.length) {
        deleteMemberships = await tx.groupMembership.findMany({
          where: { groupId, id: { in: deletes.map((it) => it.id) } },
          select: {
            id: true,
            accountId: true,
            accountAliasId: true,
            account: {
              where: { deletedAt: null, isActive: true },
              select: {
                ...ACCOUNT_SELECT,
                locale: true,
                accountAliases: { where: { verificationStatus: 'verified', deletedAt: null, isActive: true } }
              }
            },
            accountAlias: { where: { deletedAt: null, isActive: true } } // verificationStatus: 'verified'
          }
        })

        deleteds = await tx.groupMembership.softDeletes({
          tx,
          where: { groupId, ids: deletes.map((it) => it.id) },
          deletedBy: accountId
        })

        for (const { account, ...deleteMembership } of deleteMemberships) {
          if (deleteMembership.id !== membership.id) {
            toSendNoti.push(
              ...getNotificationRecipientInfoFromMembership(
                {
                  ...deleteMembership,
                  account: account && {
                    ...account,
                    locale: account.locale && (fromDbLocale(account.locale) as SupportedLocale)
                  }
                },
                locale
              ).map((it) => ({
                ...it,
                type: 'removed' as const
              }))
            )
          }
        }
      }

      // check the group memberships after updated
      const updatedMembers = await tx.groupMembership.findMany({
        where: { groupId, isActive: true },
        select: { role: true, account: { where: { deletedAt: null, isActive: true } } }
      })
      if (!updatedMembers.some((m) => m.account && m.role === $Enums.GroupMemberRole.admin)) {
        throw new WsError(WsHttpCode.BAD_REQUEST, null, 'No admin member found after updating')
      }

      const membersResult = { createds, updateds, deleteds }

      // queue Email/SMS
      await notifyUpdatedGroupMembers(group, toSendNoti, otherAccountInfo, tx)

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.group_upsertMembers,
          details: input.data,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      // BROADCAST ...

      const broadcastPayload = {
        event: 'group-members--upserted',
        orgId,
        data: { groupId: group.id }
      } satisfies WsMessageFullPayload

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, broadcastPayload)

      // broadcast to newly deleted members
      if (deleteMemberships) {
        for (const accountId of deleteMemberships.map((it) => it.accountId).filter((it): it is string => !!it)) {
          if (sentTo.has(accountId)) continue

          console.log(`--> sending upserted-group-members to:`, accountId)
          wss.socketsByAccount[accountId]?.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN && client.auth.orgId == orgId) {
              client.send(JSON.stringify(broadcastPayload))
              sentTo.add(accountId)
            }
          })
        }
      }

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          members: membersResult,
          sent_to: Array.from(sentTo)
        } satisfies Ws_GroupMembers_Upsert_Receipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpsertGroupMembers | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        error: transformError(e)
      } satisfies Ws_GroupMembers_Upsert_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
