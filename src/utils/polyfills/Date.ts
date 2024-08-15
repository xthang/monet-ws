const Date_toLocaleString = Date.prototype.toLocaleString

Date.prototype.toLocaleString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions): string {
  // if (locales?.valueOf() == 'en-US')
  return Date_toLocaleString.call(
    this,
    locales,
    options ?? {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short'
    }
  )
}
