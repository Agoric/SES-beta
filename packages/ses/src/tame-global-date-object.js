const { defineProperties } = Object;

export default function tameGlobalDateObject(dateTaming = 'safe') {
  if (dateTaming !== 'safe' && dateTaming !== 'unsafe') {
    throw new Error(`unrecognized dateTaming ${dateTaming}`);
  }
  const originalDate = Date;

  // Tame the Date constructor.
  // Common behavior
  //   * new Date(x) coerces x into a number and then returns a Date
  //     for that number of millis since the epoch
  //   * new Date(NaN) returns a Date object which stringifies to
  //     'Invalid Date'
  //   * new Date(undefined) returns a Date object which stringifies to
  //     'Invalid Date'
  // originalDate (normal standard) behavior
  //   * Date(anything) gives a string with the current time
  //   * new Date() returns the current time, as a Date object
  // sharedDate behavior
  //   * Date(anything) returned 'Invalid Date'
  //   * new Date() returns a Date object which stringifies to
  //     'Invalid Date'
  const sharedDate = function Date(...rest) {
    if (new.target === undefined) {
      return 'Invalid Date';
    }
    if (rest.length === 0) {
      rest = [NaN];
    }
    // todo: test that our constructor can still be subclassed
    return Reflect.construct(originalDate, rest, new.target);
  };

  // Use concise methods to obtain named functions without constructors.
  const tamedMethods = {
    now() {
      return NaN;
    },
  };

  const DatePrototype = originalDate.prototype;
  defineProperties(sharedDate, {
    length: { value: 7 },
    prototype: {
      value: DatePrototype,
      writable: false,
      enumerable: false,
      configurable: false,
    },
    now: {
      value: tamedMethods.now,
      writable: true,
      enumerable: false,
      configurable: true,
    },
    parse: {
      value: Date.parse,
      writable: true,
      enumerable: false,
      configurable: true,
    },
    UTC: {
      value: Date.UTC,
      writable: true,
      enumerable: false,
      configurable: true,
    },
  });
  defineProperties(DatePrototype, {
    constructor: { value: sharedDate },
  });

  return {
    start: {
      Date: {
        value: dateTaming === 'unsafe' ? originalDate : sharedDate,
        writable: true,
        enumerable: false,
        configurable: true,
      },
    },
    shared: {
      Date: {
        value: sharedDate,
        writable: true,
        enumerable: false,
        configurable: true,
      },
    },
  };
}
