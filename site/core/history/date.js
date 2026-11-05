/* One calendar for historical facts, state changes and the monthly timeline.
 * Internal dates are fractional years at month boundaries. Public events also
 * carry integer year/month fields; their time remains the authoritative date. */
(function (G) {
  'use strict';
  const index = value => Math.floor(value * 12 + 1e-7);
  const time = value => index(value) / 12;
  const ceil = value => Math.ceil(value * 12 - 1e-7) / 12;
  const year = value => Math.floor(index(value) / 12);
  const month = value => index(value) - year(value) * 12 + 1;
  const shortLabel = value => `${year(value)} 年 ${month(value)} 月`;
  const label = value => `第 ${shortLabel(value)}`;
  const eventTime = event => event.time;
  function event(source) {
    const at = time(source.year);
    return {...source, year:year(at), month:month(at), time:at};
  }
  G.HistoryDate = {index, time, ceil, year, month, label, shortLabel, eventTime, event};
})(typeof self !== 'undefined' ? self : globalThis);
