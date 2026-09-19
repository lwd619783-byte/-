// Generated from unchanged F2 V1 schemas by scripts/industry/compile-graph-validator.mjs.
// Source digests: c7c5eb72b0f4007a993025ddbe3d39db6b7f965d64912a0790734de68c671f6e 7194f50bfa2a0b3cb3fbcf54ad7acc5525674351bf29c7645ad48e272e0b52eb a39cda6f04679e91000f4dd77e5595c77f8c0d9209b0c6d9f01dfa3aa43f943c
/*! ajv runtime helper license
The MIT License (MIT)

Copyright (c) 2015-2021 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


*/
/*! ajv-formats runtime helper license
MIT License

Copyright (c) 2020 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
/*! fast-deep-equal runtime helper license
MIT License

Copyright (c) 2017 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate2, compare) {
      return { validate: validate2, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true
    };
    exports.fastFormats = {
      ...exports.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
      "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
      "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
      "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
    };
    exports.formatNames = Object.keys(exports.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches = DATE.exec(str);
      if (!matches)
        return false;
      const year = +matches[1];
      const month = +matches[2];
      const day = +matches[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2))
        return void 0;
      if (d1 > d2)
        return 1;
      if (d1 < d2)
        return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches = TIME.exec(str);
        if (!matches)
          return false;
        const hr = +matches[1];
        const min = +matches[2];
        const sec = +matches[3];
        const tz = matches[4];
        const tzSign = matches[5] === "-" ? -1 : 1;
        const tzH = +(matches[6] || 0);
        const tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return false;
        if (hr <= 23 && min <= 59 && sec < 60)
          return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return void 0;
      const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
      const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (!(t1 && t2))
        return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2))
        return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2)
        return 1;
      if (t1 < t2)
        return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2))
        return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0)
        return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
});

// <stdin>
var validate = validate20;
var stdin_default = validate20;
var schema31 = { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://investment-dashboard.local/contracts/financial-research/v1/evidence-graph.v1.schema.json", "type": "object", "additionalProperties": false, "required": ["schemaVersion", "graphId", "revision", "asOf", "nodes", "edges"], "properties": { "schemaVersion": { "const": "evidence-graph.v1" }, "graphId": { "type": "string", "minLength": 1 }, "revision": { "type": "integer", "minimum": 1 }, "asOf": { "type": "string", "format": "date-time" }, "nodes": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["nodeId", "kind", "ref", "origin", "releaseAvailableAt", "conditions", "conditionSourceRefs"], "properties": { "nodeId": { "type": "string", "minLength": 1 }, "kind": { "enum": ["source", "artifact", "evidence", "fact", "derived_metric", "claim", "thesis", "investment_expression", "position", "review"] }, "ref": { "$ref": "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin" }, "origin": { "enum": ["source_material", "provider_fact", "derived_result", "user_judgement", "ai_draft"] }, "releaseAvailableAt": { "anyOf": [{ "type": "string", "format": "date-time" }, { "type": "null" }] }, "conditions": { "$ref": "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Conditions" }, "conditionSourceRefs": { "type": "array", "items": { "$ref": "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin" }, "minItems": 0, "uniqueItems": true }, "nativeEvidenceRef": { "$ref": "https://investment-dashboard.local/contracts/v1/research-asset-os.contracts.v1.schema.json#/$defs/EvidenceRef" }, "formulaRef": { "$ref": "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin" }, "inputManifestRef": { "$ref": "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin" } } }, "minItems": 1, "uniqueItems": true }, "edges": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["relationId", "from", "to", "type", "assertedAt", "supersedesRelationId"], "properties": { "relationId": { "type": "string", "minLength": 1 }, "from": { "type": "string", "minLength": 1 }, "to": { "type": "string", "minLength": 1 }, "type": { "enum": ["publishes", "locates", "establishes", "input_to", "supports", "contradicts", "expresses", "motivates", "reviews"] }, "assertedAt": { "type": "string", "format": "date-time" }, "supersedesRelationId": { "type": ["string", "null"] } } }, "minItems": 0, "uniqueItems": true }, "previousGraphRef": { "$ref": "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin" } }, "allOf": [{ "if": { "properties": { "revision": { "type": "integer", "minimum": 2 } } }, "then": { "required": ["previousGraphRef"] } }] };
var schema34 = { "type": "array", "items": { "enum": ["missing_evidence", "partial", "stale", "conflicted", "not_admitted", "unknown"] }, "minItems": 0, "uniqueItems": true };
var func0 = Object.prototype.hasOwnProperty;
var func70 = require_ucs2length().default;
var func27 = require_equal().default;
var formats0 = require_formats().fullFormats["date-time"];
var pattern4 = new RegExp("^[a-f0-9]{64}$", "u");
var pattern5 = new RegExp("^/", "u");
var schema44 = { "type": "object", "required": ["refType", "refId"], "properties": { "refType": { "type": "string", "enum": ["provider_fact", "web_source", "document", "conversation_archive", "screenshot", "research_note", "manual_input"] }, "refId": { "$ref": "#/$defs/NonEmptyString" }, "title": { "type": "string" }, "asOf": { "$ref": "#/$defs/IsoDateTime" }, "sourceUrl": { "type": "string" }, "quality": { "type": "string", "enum": ["verified", "candidate", "partial", "stale", "unknown"] } }, "additionalProperties": false };
function validate84(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate84.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if ((data.refType === void 0 || !func0.call(data, "refType")) && (missing0 = "refType") || (data.refId === void 0 || !func0.call(data, "refId")) && (missing0 = "refId")) {
        validate84.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 of Object.keys(data)) {
          if (!(key0 === "refType" || key0 === "refId" || key0 === "title" || key0 === "asOf" || key0 === "sourceUrl" || key0 === "quality")) {
            validate84.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.refType !== void 0 && func0.call(data, "refType")) {
            let data0 = data.refType;
            const _errs2 = errors;
            if (typeof data0 !== "string") {
              validate84.errors = [{ instancePath: instancePath + "/refType", schemaPath: "#/properties/refType/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            if (!(data0 === "provider_fact" || data0 === "web_source" || data0 === "document" || data0 === "conversation_archive" || data0 === "screenshot" || data0 === "research_note" || data0 === "manual_input")) {
              validate84.errors = [{ instancePath: instancePath + "/refType", schemaPath: "#/properties/refType/enum", keyword: "enum", params: { allowedValues: schema44.properties.refType.enum }, message: "must be equal to one of the allowed values" }];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.refId !== void 0 && func0.call(data, "refId")) {
              let data1 = data.refId;
              const _errs4 = errors;
              const _errs5 = errors;
              if (errors === _errs5) {
                if (typeof data1 === "string") {
                  if (func70(data1) < 1) {
                    validate84.errors = [{ instancePath: instancePath + "/refId", schemaPath: "#/$defs/NonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate84.errors = [{ instancePath: instancePath + "/refId", schemaPath: "#/$defs/NonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.title !== void 0 && func0.call(data, "title")) {
                const _errs7 = errors;
                if (typeof data.title !== "string") {
                  validate84.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.asOf !== void 0 && func0.call(data, "asOf")) {
                  let data3 = data.asOf;
                  const _errs9 = errors;
                  const _errs10 = errors;
                  if (errors === _errs10) {
                    if (errors === _errs10) {
                      if (typeof data3 === "string") {
                        if (!formats0.validate(data3)) {
                          validate84.errors = [{ instancePath: instancePath + "/asOf", schemaPath: "#/$defs/IsoDateTime/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                          return false;
                        }
                      } else {
                        validate84.errors = [{ instancePath: instancePath + "/asOf", schemaPath: "#/$defs/IsoDateTime/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.sourceUrl !== void 0 && func0.call(data, "sourceUrl")) {
                    const _errs12 = errors;
                    if (typeof data.sourceUrl !== "string") {
                      validate84.errors = [{ instancePath: instancePath + "/sourceUrl", schemaPath: "#/properties/sourceUrl/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    var valid0 = _errs12 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.quality !== void 0 && func0.call(data, "quality")) {
                      let data5 = data.quality;
                      const _errs14 = errors;
                      if (typeof data5 !== "string") {
                        validate84.errors = [{ instancePath: instancePath + "/quality", schemaPath: "#/properties/quality/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data5 === "verified" || data5 === "candidate" || data5 === "partial" || data5 === "stale" || data5 === "unknown")) {
                        validate84.errors = [{ instancePath: instancePath + "/quality", schemaPath: "#/properties/quality/enum", keyword: "enum", params: { allowedValues: schema44.properties.quality.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid0 = _errs14 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate84.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate84.errors = vErrors;
  return errors === 0;
}
validate84.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.revision !== void 0 && func0.call(data, "revision")) {
      let data0 = data.revision;
      const _errs4 = errors;
      if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
      if (errors === _errs4) {
        if (typeof data0 == "number" && isFinite(data0)) {
          if (data0 < 2 || isNaN(data0)) {
            const err1 = {};
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
        }
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs6 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if ((data.previousGraphRef === void 0 || !func0.call(data, "previousGraphRef")) && (missing0 = "previousGraphRef")) {
        validate20.errors = [{ instancePath, schemaPath: "#/allOf/0/then/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      }
    }
    var _valid0 = _errs6 === errors;
    valid1 = _valid0;
  }
  if (!valid1) {
    const err2 = { instancePath, schemaPath: "#/allOf/0/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
    validate20.errors = vErrors;
    return false;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if ((data.schemaVersion === void 0 || !func0.call(data, "schemaVersion")) && (missing1 = "schemaVersion") || (data.graphId === void 0 || !func0.call(data, "graphId")) && (missing1 = "graphId") || (data.revision === void 0 || !func0.call(data, "revision")) && (missing1 = "revision") || (data.asOf === void 0 || !func0.call(data, "asOf")) && (missing1 = "asOf") || (data.nodes === void 0 || !func0.call(data, "nodes")) && (missing1 = "nodes") || (data.edges === void 0 || !func0.call(data, "edges")) && (missing1 = "edges")) {
        validate20.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
        return false;
      } else {
        const _errs7 = errors;
        for (const key0 of Object.keys(data)) {
          if (!(key0 === "schemaVersion" || key0 === "graphId" || key0 === "revision" || key0 === "asOf" || key0 === "nodes" || key0 === "edges" || key0 === "previousGraphRef")) {
            validate20.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs7 === errors) {
          if (data.schemaVersion !== void 0 && func0.call(data, "schemaVersion")) {
            const _errs8 = errors;
            if ("evidence-graph.v1" !== data.schemaVersion) {
              validate20.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "evidence-graph.v1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid3 = _errs8 === errors;
          } else {
            var valid3 = true;
          }
          if (valid3) {
            if (data.graphId !== void 0 && func0.call(data, "graphId")) {
              let data2 = data.graphId;
              const _errs9 = errors;
              if (errors === _errs9) {
                if (typeof data2 === "string") {
                  if (func70(data2) < 1) {
                    validate20.errors = [{ instancePath: instancePath + "/graphId", schemaPath: "#/properties/graphId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate20.errors = [{ instancePath: instancePath + "/graphId", schemaPath: "#/properties/graphId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid3 = _errs9 === errors;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.revision !== void 0 && func0.call(data, "revision")) {
                let data3 = data.revision;
                const _errs11 = errors;
                if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                  validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                  return false;
                }
                if (errors === _errs11) {
                  if (typeof data3 == "number" && isFinite(data3)) {
                    if (data3 < 1 || isNaN(data3)) {
                      validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                      return false;
                    }
                  }
                }
                var valid3 = _errs11 === errors;
              } else {
                var valid3 = true;
              }
              if (valid3) {
                if (data.asOf !== void 0 && func0.call(data, "asOf")) {
                  let data4 = data.asOf;
                  const _errs13 = errors;
                  if (errors === _errs13) {
                    if (errors === _errs13) {
                      if (typeof data4 === "string") {
                        if (!formats0.validate(data4)) {
                          validate20.errors = [{ instancePath: instancePath + "/asOf", schemaPath: "#/properties/asOf/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                          return false;
                        }
                      } else {
                        validate20.errors = [{ instancePath: instancePath + "/asOf", schemaPath: "#/properties/asOf/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid3 = _errs13 === errors;
                } else {
                  var valid3 = true;
                }
                if (valid3) {
                  if (data.nodes !== void 0 && func0.call(data, "nodes")) {
                    let data5 = data.nodes;
                    const _errs15 = errors;
                    if (errors === _errs15) {
                      if (Array.isArray(data5)) {
                        if (data5.length < 1) {
                          validate20.errors = [{ instancePath: instancePath + "/nodes", schemaPath: "#/properties/nodes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                          return false;
                        } else {
                          var valid4 = true;
                          const len0 = data5.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            let data6 = data5[i0];
                            const _errs17 = errors;
                            if (errors === _errs17) {
                              if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
                                let missing2;
                                if ((data6.nodeId === void 0 || !func0.call(data6, "nodeId")) && (missing2 = "nodeId") || (data6.kind === void 0 || !func0.call(data6, "kind")) && (missing2 = "kind") || (data6.ref === void 0 || !func0.call(data6, "ref")) && (missing2 = "ref") || (data6.origin === void 0 || !func0.call(data6, "origin")) && (missing2 = "origin") || (data6.releaseAvailableAt === void 0 || !func0.call(data6, "releaseAvailableAt")) && (missing2 = "releaseAvailableAt") || (data6.conditions === void 0 || !func0.call(data6, "conditions")) && (missing2 = "conditions") || (data6.conditionSourceRefs === void 0 || !func0.call(data6, "conditionSourceRefs")) && (missing2 = "conditionSourceRefs")) {
                                  validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0, schemaPath: "#/properties/nodes/items/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                  return false;
                                } else {
                                  const _errs19 = errors;
                                  for (const key1 of Object.keys(data6)) {
                                    if (!func0.call(schema31.properties.nodes.items.properties, key1)) {
                                      validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0, schemaPath: "#/properties/nodes/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs19 === errors) {
                                    if (data6.nodeId !== void 0 && func0.call(data6, "nodeId")) {
                                      let data7 = data6.nodeId;
                                      const _errs20 = errors;
                                      if (errors === _errs20) {
                                        if (typeof data7 === "string") {
                                          if (func70(data7) < 1) {
                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/nodeId", schemaPath: "#/properties/nodes/items/properties/nodeId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          }
                                        } else {
                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/nodeId", schemaPath: "#/properties/nodes/items/properties/nodeId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid5 = _errs20 === errors;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data6.kind !== void 0 && func0.call(data6, "kind")) {
                                        let data8 = data6.kind;
                                        const _errs22 = errors;
                                        if (!(data8 === "source" || data8 === "artifact" || data8 === "evidence" || data8 === "fact" || data8 === "derived_metric" || data8 === "claim" || data8 === "thesis" || data8 === "investment_expression" || data8 === "position" || data8 === "review")) {
                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/kind", schemaPath: "#/properties/nodes/items/properties/kind/enum", keyword: "enum", params: { allowedValues: schema31.properties.nodes.items.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid5 = _errs22 === errors;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data6.ref !== void 0 && func0.call(data6, "ref")) {
                                          let data9 = data6.ref;
                                          const _errs23 = errors;
                                          const _errs24 = errors;
                                          if (errors === _errs24) {
                                            if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                                              let missing3;
                                              if ((data9.owner === void 0 || !func0.call(data9, "owner")) && (missing3 = "owner") || (data9.objectId === void 0 || !func0.call(data9, "objectId")) && (missing3 = "objectId") || (data9.version === void 0 || !func0.call(data9, "version")) && (missing3 = "version") || (data9.sha256 === void 0 || !func0.call(data9, "sha256")) && (missing3 = "sha256") || (data9.locator === void 0 || !func0.call(data9, "locator")) && (missing3 = "locator")) {
                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                                return false;
                                              } else {
                                                const _errs26 = errors;
                                                for (const key2 of Object.keys(data9)) {
                                                  if (!(key2 === "owner" || key2 === "objectId" || key2 === "version" || key2 === "sha256" || key2 === "locator")) {
                                                    validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                                    return false;
                                                    break;
                                                  }
                                                }
                                                if (_errs26 === errors) {
                                                  if (data9.owner !== void 0 && func0.call(data9, "owner")) {
                                                    let data10 = data9.owner;
                                                    const _errs27 = errors;
                                                    if (errors === _errs27) {
                                                      if (typeof data10 === "string") {
                                                        if (func70(data10) < 1) {
                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      } else {
                                                        validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid7 = _errs27 === errors;
                                                  } else {
                                                    var valid7 = true;
                                                  }
                                                  if (valid7) {
                                                    if (data9.objectId !== void 0 && func0.call(data9, "objectId")) {
                                                      let data11 = data9.objectId;
                                                      const _errs29 = errors;
                                                      if (errors === _errs29) {
                                                        if (typeof data11 === "string") {
                                                          if (func70(data11) < 1) {
                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        } else {
                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid7 = _errs29 === errors;
                                                    } else {
                                                      var valid7 = true;
                                                    }
                                                    if (valid7) {
                                                      if (data9.version !== void 0 && func0.call(data9, "version")) {
                                                        let data12 = data9.version;
                                                        const _errs31 = errors;
                                                        if (errors === _errs31) {
                                                          if (typeof data12 === "string") {
                                                            if (func70(data12) < 1) {
                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                              return false;
                                                            }
                                                          } else {
                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                            return false;
                                                          }
                                                        }
                                                        var valid7 = _errs31 === errors;
                                                      } else {
                                                        var valid7 = true;
                                                      }
                                                      if (valid7) {
                                                        if (data9.sha256 !== void 0 && func0.call(data9, "sha256")) {
                                                          let data13 = data9.sha256;
                                                          const _errs33 = errors;
                                                          if (errors === _errs33) {
                                                            if (typeof data13 === "string") {
                                                              if (!pattern4.test(data13)) {
                                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                return false;
                                                              }
                                                            } else {
                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                              return false;
                                                            }
                                                          }
                                                          var valid7 = _errs33 === errors;
                                                        } else {
                                                          var valid7 = true;
                                                        }
                                                        if (valid7) {
                                                          if (data9.locator !== void 0 && func0.call(data9, "locator")) {
                                                            let data14 = data9.locator;
                                                            const _errs35 = errors;
                                                            if (errors === _errs35) {
                                                              if (typeof data14 === "string") {
                                                                if (!pattern5.test(data14)) {
                                                                  validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/pattern", keyword: "pattern", params: { pattern: "^/" }, message: 'must match pattern "^/"' }];
                                                                  return false;
                                                                }
                                                              } else {
                                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                return false;
                                                              }
                                                            }
                                                            var valid7 = _errs35 === errors;
                                                          } else {
                                                            var valid7 = true;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/ref", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                              return false;
                                            }
                                          }
                                          var valid5 = _errs23 === errors;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data6.origin !== void 0 && func0.call(data6, "origin")) {
                                            let data15 = data6.origin;
                                            const _errs37 = errors;
                                            if (!(data15 === "source_material" || data15 === "provider_fact" || data15 === "derived_result" || data15 === "user_judgement" || data15 === "ai_draft")) {
                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/origin", schemaPath: "#/properties/nodes/items/properties/origin/enum", keyword: "enum", params: { allowedValues: schema31.properties.nodes.items.properties.origin.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid5 = _errs37 === errors;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data6.releaseAvailableAt !== void 0 && func0.call(data6, "releaseAvailableAt")) {
                                              let data16 = data6.releaseAvailableAt;
                                              const _errs38 = errors;
                                              const _errs39 = errors;
                                              let valid8 = false;
                                              const _errs40 = errors;
                                              if (errors === _errs40) {
                                                if (errors === _errs40) {
                                                  if (typeof data16 === "string") {
                                                    if (!formats0.validate(data16)) {
                                                      const err3 = { instancePath: instancePath + "/nodes/" + i0 + "/releaseAvailableAt", schemaPath: "#/properties/nodes/items/properties/releaseAvailableAt/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                      if (vErrors === null) {
                                                        vErrors = [err3];
                                                      } else {
                                                        vErrors.push(err3);
                                                      }
                                                      errors++;
                                                    }
                                                  } else {
                                                    const err4 = { instancePath: instancePath + "/nodes/" + i0 + "/releaseAvailableAt", schemaPath: "#/properties/nodes/items/properties/releaseAvailableAt/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err4];
                                                    } else {
                                                      vErrors.push(err4);
                                                    }
                                                    errors++;
                                                  }
                                                }
                                              }
                                              var _valid1 = _errs40 === errors;
                                              valid8 = valid8 || _valid1;
                                              const _errs42 = errors;
                                              if (data16 !== null) {
                                                const err5 = { instancePath: instancePath + "/nodes/" + i0 + "/releaseAvailableAt", schemaPath: "#/properties/nodes/items/properties/releaseAvailableAt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                if (vErrors === null) {
                                                  vErrors = [err5];
                                                } else {
                                                  vErrors.push(err5);
                                                }
                                                errors++;
                                              }
                                              var _valid1 = _errs42 === errors;
                                              valid8 = valid8 || _valid1;
                                              if (!valid8) {
                                                const err6 = { instancePath: instancePath + "/nodes/" + i0 + "/releaseAvailableAt", schemaPath: "#/properties/nodes/items/properties/releaseAvailableAt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                if (vErrors === null) {
                                                  vErrors = [err6];
                                                } else {
                                                  vErrors.push(err6);
                                                }
                                                errors++;
                                                validate20.errors = vErrors;
                                                return false;
                                              } else {
                                                errors = _errs39;
                                                if (vErrors !== null) {
                                                  if (_errs39) {
                                                    vErrors.length = _errs39;
                                                  } else {
                                                    vErrors = null;
                                                  }
                                                }
                                              }
                                              var valid5 = _errs38 === errors;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data6.conditions !== void 0 && func0.call(data6, "conditions")) {
                                                let data17 = data6.conditions;
                                                const _errs44 = errors;
                                                const _errs45 = errors;
                                                if (errors === _errs45) {
                                                  if (Array.isArray(data17)) {
                                                    if (data17.length < 0) {
                                                      validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditions", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Conditions/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                                                      return false;
                                                    } else {
                                                      var valid10 = true;
                                                      const len1 = data17.length;
                                                      for (let i1 = 0; i1 < len1; i1++) {
                                                        let data18 = data17[i1];
                                                        const _errs47 = errors;
                                                        if (!(data18 === "missing_evidence" || data18 === "partial" || data18 === "stale" || data18 === "conflicted" || data18 === "not_admitted" || data18 === "unknown")) {
                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditions/" + i1, schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Conditions/items/enum", keyword: "enum", params: { allowedValues: schema34.items.enum }, message: "must be equal to one of the allowed values" }];
                                                          return false;
                                                        }
                                                        var valid10 = _errs47 === errors;
                                                        if (!valid10) {
                                                          break;
                                                        }
                                                      }
                                                      if (valid10) {
                                                        let i2 = data17.length;
                                                        let j0;
                                                        if (i2 > 1) {
                                                          outer0:
                                                            for (; i2--; ) {
                                                              for (j0 = i2; j0--; ) {
                                                                if (func27(data17[i2], data17[j0])) {
                                                                  validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditions", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Conditions/uniqueItems", keyword: "uniqueItems", params: { i: i2, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)" }];
                                                                  return false;
                                                                  break outer0;
                                                                }
                                                              }
                                                            }
                                                        }
                                                      }
                                                    }
                                                  } else {
                                                    validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditions", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Conditions/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                    return false;
                                                  }
                                                }
                                                var valid5 = _errs44 === errors;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data6.conditionSourceRefs !== void 0 && func0.call(data6, "conditionSourceRefs")) {
                                                  let data19 = data6.conditionSourceRefs;
                                                  const _errs48 = errors;
                                                  if (errors === _errs48) {
                                                    if (Array.isArray(data19)) {
                                                      if (data19.length < 0) {
                                                        validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs", schemaPath: "#/properties/nodes/items/properties/conditionSourceRefs/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                                                        return false;
                                                      } else {
                                                        var valid12 = true;
                                                        const len2 = data19.length;
                                                        for (let i3 = 0; i3 < len2; i3++) {
                                                          let data20 = data19[i3];
                                                          const _errs50 = errors;
                                                          const _errs51 = errors;
                                                          if (errors === _errs51) {
                                                            if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                                              let missing4;
                                                              if ((data20.owner === void 0 || !func0.call(data20, "owner")) && (missing4 = "owner") || (data20.objectId === void 0 || !func0.call(data20, "objectId")) && (missing4 = "objectId") || (data20.version === void 0 || !func0.call(data20, "version")) && (missing4 = "version") || (data20.sha256 === void 0 || !func0.call(data20, "sha256")) && (missing4 = "sha256") || (data20.locator === void 0 || !func0.call(data20, "locator")) && (missing4 = "locator")) {
                                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3, schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                                                return false;
                                                              } else {
                                                                const _errs53 = errors;
                                                                for (const key3 of Object.keys(data20)) {
                                                                  if (!(key3 === "owner" || key3 === "objectId" || key3 === "version" || key3 === "sha256" || key3 === "locator")) {
                                                                    validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3, schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                                                    return false;
                                                                    break;
                                                                  }
                                                                }
                                                                if (_errs53 === errors) {
                                                                  if (data20.owner !== void 0 && func0.call(data20, "owner")) {
                                                                    let data21 = data20.owner;
                                                                    const _errs54 = errors;
                                                                    if (errors === _errs54) {
                                                                      if (typeof data21 === "string") {
                                                                        if (func70(data21) < 1) {
                                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                          return false;
                                                                        }
                                                                      } else {
                                                                        validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                    var valid14 = _errs54 === errors;
                                                                  } else {
                                                                    var valid14 = true;
                                                                  }
                                                                  if (valid14) {
                                                                    if (data20.objectId !== void 0 && func0.call(data20, "objectId")) {
                                                                      let data22 = data20.objectId;
                                                                      const _errs56 = errors;
                                                                      if (errors === _errs56) {
                                                                        if (typeof data22 === "string") {
                                                                          if (func70(data22) < 1) {
                                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                            return false;
                                                                          }
                                                                        } else {
                                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid14 = _errs56 === errors;
                                                                    } else {
                                                                      var valid14 = true;
                                                                    }
                                                                    if (valid14) {
                                                                      if (data20.version !== void 0 && func0.call(data20, "version")) {
                                                                        let data23 = data20.version;
                                                                        const _errs58 = errors;
                                                                        if (errors === _errs58) {
                                                                          if (typeof data23 === "string") {
                                                                            if (func70(data23) < 1) {
                                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                              return false;
                                                                            }
                                                                          } else {
                                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                        var valid14 = _errs58 === errors;
                                                                      } else {
                                                                        var valid14 = true;
                                                                      }
                                                                      if (valid14) {
                                                                        if (data20.sha256 !== void 0 && func0.call(data20, "sha256")) {
                                                                          let data24 = data20.sha256;
                                                                          const _errs60 = errors;
                                                                          if (errors === _errs60) {
                                                                            if (typeof data24 === "string") {
                                                                              if (!pattern4.test(data24)) {
                                                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                                return false;
                                                                              }
                                                                            } else {
                                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                          var valid14 = _errs60 === errors;
                                                                        } else {
                                                                          var valid14 = true;
                                                                        }
                                                                        if (valid14) {
                                                                          if (data20.locator !== void 0 && func0.call(data20, "locator")) {
                                                                            let data25 = data20.locator;
                                                                            const _errs62 = errors;
                                                                            if (errors === _errs62) {
                                                                              if (typeof data25 === "string") {
                                                                                if (!pattern5.test(data25)) {
                                                                                  validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/pattern", keyword: "pattern", params: { pattern: "^/" }, message: 'must match pattern "^/"' }];
                                                                                  return false;
                                                                                }
                                                                              } else {
                                                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3 + "/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                            var valid14 = _errs62 === errors;
                                                                          } else {
                                                                            var valid14 = true;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            } else {
                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs/" + i3, schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                              return false;
                                                            }
                                                          }
                                                          var valid12 = _errs50 === errors;
                                                          if (!valid12) {
                                                            break;
                                                          }
                                                        }
                                                        if (valid12) {
                                                          let i4 = data19.length;
                                                          let j1;
                                                          if (i4 > 1) {
                                                            outer1:
                                                              for (; i4--; ) {
                                                                for (j1 = i4; j1--; ) {
                                                                  if (func27(data19[i4], data19[j1])) {
                                                                    validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs", schemaPath: "#/properties/nodes/items/properties/conditionSourceRefs/uniqueItems", keyword: "uniqueItems", params: { i: i4, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i4 + " are identical)" }];
                                                                    return false;
                                                                    break outer1;
                                                                  }
                                                                }
                                                              }
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/conditionSourceRefs", schemaPath: "#/properties/nodes/items/properties/conditionSourceRefs/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid5 = _errs48 === errors;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data6.nativeEvidenceRef !== void 0 && func0.call(data6, "nativeEvidenceRef")) {
                                                    const _errs64 = errors;
                                                    if (!validate84(data6.nativeEvidenceRef, { instancePath: instancePath + "/nodes/" + i0 + "/nativeEvidenceRef", parentData: data6, parentDataProperty: "nativeEvidenceRef", rootData, dynamicAnchors })) {
                                                      vErrors = vErrors === null ? validate84.errors : vErrors.concat(validate84.errors);
                                                      errors = vErrors.length;
                                                    }
                                                    var valid5 = _errs64 === errors;
                                                  } else {
                                                    var valid5 = true;
                                                  }
                                                  if (valid5) {
                                                    if (data6.formulaRef !== void 0 && func0.call(data6, "formulaRef")) {
                                                      let data27 = data6.formulaRef;
                                                      const _errs65 = errors;
                                                      const _errs66 = errors;
                                                      if (errors === _errs66) {
                                                        if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
                                                          let missing5;
                                                          if ((data27.owner === void 0 || !func0.call(data27, "owner")) && (missing5 = "owner") || (data27.objectId === void 0 || !func0.call(data27, "objectId")) && (missing5 = "objectId") || (data27.version === void 0 || !func0.call(data27, "version")) && (missing5 = "version") || (data27.sha256 === void 0 || !func0.call(data27, "sha256")) && (missing5 = "sha256") || (data27.locator === void 0 || !func0.call(data27, "locator")) && (missing5 = "locator")) {
                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                                                            return false;
                                                          } else {
                                                            const _errs68 = errors;
                                                            for (const key4 of Object.keys(data27)) {
                                                              if (!(key4 === "owner" || key4 === "objectId" || key4 === "version" || key4 === "sha256" || key4 === "locator")) {
                                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                                return false;
                                                                break;
                                                              }
                                                            }
                                                            if (_errs68 === errors) {
                                                              if (data27.owner !== void 0 && func0.call(data27, "owner")) {
                                                                let data28 = data27.owner;
                                                                const _errs69 = errors;
                                                                if (errors === _errs69) {
                                                                  if (typeof data28 === "string") {
                                                                    if (func70(data28) < 1) {
                                                                      validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                      return false;
                                                                    }
                                                                  } else {
                                                                    validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                    return false;
                                                                  }
                                                                }
                                                                var valid17 = _errs69 === errors;
                                                              } else {
                                                                var valid17 = true;
                                                              }
                                                              if (valid17) {
                                                                if (data27.objectId !== void 0 && func0.call(data27, "objectId")) {
                                                                  let data29 = data27.objectId;
                                                                  const _errs71 = errors;
                                                                  if (errors === _errs71) {
                                                                    if (typeof data29 === "string") {
                                                                      if (func70(data29) < 1) {
                                                                        validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                        return false;
                                                                      }
                                                                    } else {
                                                                      validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                  var valid17 = _errs71 === errors;
                                                                } else {
                                                                  var valid17 = true;
                                                                }
                                                                if (valid17) {
                                                                  if (data27.version !== void 0 && func0.call(data27, "version")) {
                                                                    let data30 = data27.version;
                                                                    const _errs73 = errors;
                                                                    if (errors === _errs73) {
                                                                      if (typeof data30 === "string") {
                                                                        if (func70(data30) < 1) {
                                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                          return false;
                                                                        }
                                                                      } else {
                                                                        validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                    var valid17 = _errs73 === errors;
                                                                  } else {
                                                                    var valid17 = true;
                                                                  }
                                                                  if (valid17) {
                                                                    if (data27.sha256 !== void 0 && func0.call(data27, "sha256")) {
                                                                      let data31 = data27.sha256;
                                                                      const _errs75 = errors;
                                                                      if (errors === _errs75) {
                                                                        if (typeof data31 === "string") {
                                                                          if (!pattern4.test(data31)) {
                                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                            return false;
                                                                          }
                                                                        } else {
                                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid17 = _errs75 === errors;
                                                                    } else {
                                                                      var valid17 = true;
                                                                    }
                                                                    if (valid17) {
                                                                      if (data27.locator !== void 0 && func0.call(data27, "locator")) {
                                                                        let data32 = data27.locator;
                                                                        const _errs77 = errors;
                                                                        if (errors === _errs77) {
                                                                          if (typeof data32 === "string") {
                                                                            if (!pattern5.test(data32)) {
                                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/pattern", keyword: "pattern", params: { pattern: "^/" }, message: 'must match pattern "^/"' }];
                                                                              return false;
                                                                            }
                                                                          } else {
                                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                        var valid17 = _errs77 === errors;
                                                                      } else {
                                                                        var valid17 = true;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        } else {
                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/formulaRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid5 = _errs65 === errors;
                                                    } else {
                                                      var valid5 = true;
                                                    }
                                                    if (valid5) {
                                                      if (data6.inputManifestRef !== void 0 && func0.call(data6, "inputManifestRef")) {
                                                        let data33 = data6.inputManifestRef;
                                                        const _errs79 = errors;
                                                        const _errs80 = errors;
                                                        if (errors === _errs80) {
                                                          if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
                                                            let missing6;
                                                            if ((data33.owner === void 0 || !func0.call(data33, "owner")) && (missing6 = "owner") || (data33.objectId === void 0 || !func0.call(data33, "objectId")) && (missing6 = "objectId") || (data33.version === void 0 || !func0.call(data33, "version")) && (missing6 = "version") || (data33.sha256 === void 0 || !func0.call(data33, "sha256")) && (missing6 = "sha256") || (data33.locator === void 0 || !func0.call(data33, "locator")) && (missing6 = "locator")) {
                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                                                              return false;
                                                            } else {
                                                              const _errs82 = errors;
                                                              for (const key5 of Object.keys(data33)) {
                                                                if (!(key5 === "owner" || key5 === "objectId" || key5 === "version" || key5 === "sha256" || key5 === "locator")) {
                                                                  validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                                  return false;
                                                                  break;
                                                                }
                                                              }
                                                              if (_errs82 === errors) {
                                                                if (data33.owner !== void 0 && func0.call(data33, "owner")) {
                                                                  let data34 = data33.owner;
                                                                  const _errs83 = errors;
                                                                  if (errors === _errs83) {
                                                                    if (typeof data34 === "string") {
                                                                      if (func70(data34) < 1) {
                                                                        validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                        return false;
                                                                      }
                                                                    } else {
                                                                      validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                  var valid19 = _errs83 === errors;
                                                                } else {
                                                                  var valid19 = true;
                                                                }
                                                                if (valid19) {
                                                                  if (data33.objectId !== void 0 && func0.call(data33, "objectId")) {
                                                                    let data35 = data33.objectId;
                                                                    const _errs85 = errors;
                                                                    if (errors === _errs85) {
                                                                      if (typeof data35 === "string") {
                                                                        if (func70(data35) < 1) {
                                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                          return false;
                                                                        }
                                                                      } else {
                                                                        validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                    var valid19 = _errs85 === errors;
                                                                  } else {
                                                                    var valid19 = true;
                                                                  }
                                                                  if (valid19) {
                                                                    if (data33.version !== void 0 && func0.call(data33, "version")) {
                                                                      let data36 = data33.version;
                                                                      const _errs87 = errors;
                                                                      if (errors === _errs87) {
                                                                        if (typeof data36 === "string") {
                                                                          if (func70(data36) < 1) {
                                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                            return false;
                                                                          }
                                                                        } else {
                                                                          validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid19 = _errs87 === errors;
                                                                    } else {
                                                                      var valid19 = true;
                                                                    }
                                                                    if (valid19) {
                                                                      if (data33.sha256 !== void 0 && func0.call(data33, "sha256")) {
                                                                        let data37 = data33.sha256;
                                                                        const _errs89 = errors;
                                                                        if (errors === _errs89) {
                                                                          if (typeof data37 === "string") {
                                                                            if (!pattern4.test(data37)) {
                                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                              return false;
                                                                            }
                                                                          } else {
                                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                        var valid19 = _errs89 === errors;
                                                                      } else {
                                                                        var valid19 = true;
                                                                      }
                                                                      if (valid19) {
                                                                        if (data33.locator !== void 0 && func0.call(data33, "locator")) {
                                                                          let data38 = data33.locator;
                                                                          const _errs91 = errors;
                                                                          if (errors === _errs91) {
                                                                            if (typeof data38 === "string") {
                                                                              if (!pattern5.test(data38)) {
                                                                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/pattern", keyword: "pattern", params: { pattern: "^/" }, message: 'must match pattern "^/"' }];
                                                                                return false;
                                                                              }
                                                                            } else {
                                                                              validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                          var valid19 = _errs91 === errors;
                                                                        } else {
                                                                          var valid19 = true;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          } else {
                                                            validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0 + "/inputManifestRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                            return false;
                                                          }
                                                        }
                                                        var valid5 = _errs79 === errors;
                                                      } else {
                                                        var valid5 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate20.errors = [{ instancePath: instancePath + "/nodes/" + i0, schemaPath: "#/properties/nodes/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid4 = _errs17 === errors;
                            if (!valid4) {
                              break;
                            }
                          }
                          if (valid4) {
                            let i5 = data5.length;
                            let j2;
                            if (i5 > 1) {
                              outer2:
                                for (; i5--; ) {
                                  for (j2 = i5; j2--; ) {
                                    if (func27(data5[i5], data5[j2])) {
                                      validate20.errors = [{ instancePath: instancePath + "/nodes", schemaPath: "#/properties/nodes/uniqueItems", keyword: "uniqueItems", params: { i: i5, j: j2 }, message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)" }];
                                      return false;
                                      break outer2;
                                    }
                                  }
                                }
                            }
                          }
                        }
                      } else {
                        validate20.errors = [{ instancePath: instancePath + "/nodes", schemaPath: "#/properties/nodes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid3 = _errs15 === errors;
                  } else {
                    var valid3 = true;
                  }
                  if (valid3) {
                    if (data.edges !== void 0 && func0.call(data, "edges")) {
                      let data39 = data.edges;
                      const _errs93 = errors;
                      if (errors === _errs93) {
                        if (Array.isArray(data39)) {
                          if (data39.length < 0) {
                            validate20.errors = [{ instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                            return false;
                          } else {
                            var valid21 = true;
                            const len3 = data39.length;
                            for (let i6 = 0; i6 < len3; i6++) {
                              let data40 = data39[i6];
                              const _errs95 = errors;
                              if (errors === _errs95) {
                                if (data40 && typeof data40 == "object" && !Array.isArray(data40)) {
                                  let missing7;
                                  if ((data40.relationId === void 0 || !func0.call(data40, "relationId")) && (missing7 = "relationId") || (data40.from === void 0 || !func0.call(data40, "from")) && (missing7 = "from") || (data40.to === void 0 || !func0.call(data40, "to")) && (missing7 = "to") || (data40.type === void 0 || !func0.call(data40, "type")) && (missing7 = "type") || (data40.assertedAt === void 0 || !func0.call(data40, "assertedAt")) && (missing7 = "assertedAt") || (data40.supersedesRelationId === void 0 || !func0.call(data40, "supersedesRelationId")) && (missing7 = "supersedesRelationId")) {
                                    validate20.errors = [{ instancePath: instancePath + "/edges/" + i6, schemaPath: "#/properties/edges/items/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" }];
                                    return false;
                                  } else {
                                    const _errs97 = errors;
                                    for (const key6 of Object.keys(data40)) {
                                      if (!(key6 === "relationId" || key6 === "from" || key6 === "to" || key6 === "type" || key6 === "assertedAt" || key6 === "supersedesRelationId")) {
                                        validate20.errors = [{ instancePath: instancePath + "/edges/" + i6, schemaPath: "#/properties/edges/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs97 === errors) {
                                      if (data40.relationId !== void 0 && func0.call(data40, "relationId")) {
                                        let data41 = data40.relationId;
                                        const _errs98 = errors;
                                        if (errors === _errs98) {
                                          if (typeof data41 === "string") {
                                            if (func70(data41) < 1) {
                                              validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/relationId", schemaPath: "#/properties/edges/items/properties/relationId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          } else {
                                            validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/relationId", schemaPath: "#/properties/edges/items/properties/relationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid22 = _errs98 === errors;
                                      } else {
                                        var valid22 = true;
                                      }
                                      if (valid22) {
                                        if (data40.from !== void 0 && func0.call(data40, "from")) {
                                          let data42 = data40.from;
                                          const _errs100 = errors;
                                          if (errors === _errs100) {
                                            if (typeof data42 === "string") {
                                              if (func70(data42) < 1) {
                                                validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/from", schemaPath: "#/properties/edges/items/properties/from/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                return false;
                                              }
                                            } else {
                                              validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/from", schemaPath: "#/properties/edges/items/properties/from/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid22 = _errs100 === errors;
                                        } else {
                                          var valid22 = true;
                                        }
                                        if (valid22) {
                                          if (data40.to !== void 0 && func0.call(data40, "to")) {
                                            let data43 = data40.to;
                                            const _errs102 = errors;
                                            if (errors === _errs102) {
                                              if (typeof data43 === "string") {
                                                if (func70(data43) < 1) {
                                                  validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/to", schemaPath: "#/properties/edges/items/properties/to/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              } else {
                                                validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/to", schemaPath: "#/properties/edges/items/properties/to/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid22 = _errs102 === errors;
                                          } else {
                                            var valid22 = true;
                                          }
                                          if (valid22) {
                                            if (data40.type !== void 0 && func0.call(data40, "type")) {
                                              let data44 = data40.type;
                                              const _errs104 = errors;
                                              if (!(data44 === "publishes" || data44 === "locates" || data44 === "establishes" || data44 === "input_to" || data44 === "supports" || data44 === "contradicts" || data44 === "expresses" || data44 === "motivates" || data44 === "reviews")) {
                                                validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/type", schemaPath: "#/properties/edges/items/properties/type/enum", keyword: "enum", params: { allowedValues: schema31.properties.edges.items.properties.type.enum }, message: "must be equal to one of the allowed values" }];
                                                return false;
                                              }
                                              var valid22 = _errs104 === errors;
                                            } else {
                                              var valid22 = true;
                                            }
                                            if (valid22) {
                                              if (data40.assertedAt !== void 0 && func0.call(data40, "assertedAt")) {
                                                let data45 = data40.assertedAt;
                                                const _errs105 = errors;
                                                if (errors === _errs105) {
                                                  if (errors === _errs105) {
                                                    if (typeof data45 === "string") {
                                                      if (!formats0.validate(data45)) {
                                                        validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/assertedAt", schemaPath: "#/properties/edges/items/properties/assertedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                        return false;
                                                      }
                                                    } else {
                                                      validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/assertedAt", schemaPath: "#/properties/edges/items/properties/assertedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                                var valid22 = _errs105 === errors;
                                              } else {
                                                var valid22 = true;
                                              }
                                              if (valid22) {
                                                if (data40.supersedesRelationId !== void 0 && func0.call(data40, "supersedesRelationId")) {
                                                  let data46 = data40.supersedesRelationId;
                                                  const _errs107 = errors;
                                                  if (typeof data46 !== "string" && data46 !== null) {
                                                    validate20.errors = [{ instancePath: instancePath + "/edges/" + i6 + "/supersedesRelationId", schemaPath: "#/properties/edges/items/properties/supersedesRelationId/type", keyword: "type", params: { type: schema31.properties.edges.items.properties.supersedesRelationId.type }, message: "must be string,null" }];
                                                    return false;
                                                  }
                                                  var valid22 = _errs107 === errors;
                                                } else {
                                                  var valid22 = true;
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate20.errors = [{ instancePath: instancePath + "/edges/" + i6, schemaPath: "#/properties/edges/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid21 = _errs95 === errors;
                              if (!valid21) {
                                break;
                              }
                            }
                            if (valid21) {
                              let i7 = data39.length;
                              let j3;
                              if (i7 > 1) {
                                outer3:
                                  for (; i7--; ) {
                                    for (j3 = i7; j3--; ) {
                                      if (func27(data39[i7], data39[j3])) {
                                        validate20.errors = [{ instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/uniqueItems", keyword: "uniqueItems", params: { i: i7, j: j3 }, message: "must NOT have duplicate items (items ## " + j3 + " and " + i7 + " are identical)" }];
                                        return false;
                                        break outer3;
                                      }
                                    }
                                  }
                              }
                            }
                          }
                        } else {
                          validate20.errors = [{ instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid3 = _errs93 === errors;
                    } else {
                      var valid3 = true;
                    }
                    if (valid3) {
                      if (data.previousGraphRef !== void 0 && func0.call(data, "previousGraphRef")) {
                        let data47 = data.previousGraphRef;
                        const _errs109 = errors;
                        const _errs110 = errors;
                        if (errors === _errs110) {
                          if (data47 && typeof data47 == "object" && !Array.isArray(data47)) {
                            let missing8;
                            if ((data47.owner === void 0 || !func0.call(data47, "owner")) && (missing8 = "owner") || (data47.objectId === void 0 || !func0.call(data47, "objectId")) && (missing8 = "objectId") || (data47.version === void 0 || !func0.call(data47, "version")) && (missing8 = "version") || (data47.sha256 === void 0 || !func0.call(data47, "sha256")) && (missing8 = "sha256") || (data47.locator === void 0 || !func0.call(data47, "locator")) && (missing8 = "locator")) {
                              validate20.errors = [{ instancePath: instancePath + "/previousGraphRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" }];
                              return false;
                            } else {
                              const _errs112 = errors;
                              for (const key7 of Object.keys(data47)) {
                                if (!(key7 === "owner" || key7 === "objectId" || key7 === "version" || key7 === "sha256" || key7 === "locator")) {
                                  validate20.errors = [{ instancePath: instancePath + "/previousGraphRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs112 === errors) {
                                if (data47.owner !== void 0 && func0.call(data47, "owner")) {
                                  let data48 = data47.owner;
                                  const _errs113 = errors;
                                  if (errors === _errs113) {
                                    if (typeof data48 === "string") {
                                      if (func70(data48) < 1) {
                                        validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    } else {
                                      validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/owner", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/owner/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid25 = _errs113 === errors;
                                } else {
                                  var valid25 = true;
                                }
                                if (valid25) {
                                  if (data47.objectId !== void 0 && func0.call(data47, "objectId")) {
                                    let data49 = data47.objectId;
                                    const _errs115 = errors;
                                    if (errors === _errs115) {
                                      if (typeof data49 === "string") {
                                        if (func70(data49) < 1) {
                                          validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      } else {
                                        validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/objectId", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid25 = _errs115 === errors;
                                  } else {
                                    var valid25 = true;
                                  }
                                  if (valid25) {
                                    if (data47.version !== void 0 && func0.call(data47, "version")) {
                                      let data50 = data47.version;
                                      const _errs117 = errors;
                                      if (errors === _errs117) {
                                        if (typeof data50 === "string") {
                                          if (func70(data50) < 1) {
                                            validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          }
                                        } else {
                                          validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/version", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/version/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid25 = _errs117 === errors;
                                    } else {
                                      var valid25 = true;
                                    }
                                    if (valid25) {
                                      if (data47.sha256 !== void 0 && func0.call(data47, "sha256")) {
                                        let data51 = data47.sha256;
                                        const _errs119 = errors;
                                        if (errors === _errs119) {
                                          if (typeof data51 === "string") {
                                            if (!pattern4.test(data51)) {
                                              validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/sha256", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid25 = _errs119 === errors;
                                      } else {
                                        var valid25 = true;
                                      }
                                      if (valid25) {
                                        if (data47.locator !== void 0 && func0.call(data47, "locator")) {
                                          let data52 = data47.locator;
                                          const _errs121 = errors;
                                          if (errors === _errs121) {
                                            if (typeof data52 === "string") {
                                              if (!pattern5.test(data52)) {
                                                validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/pattern", keyword: "pattern", params: { pattern: "^/" }, message: 'must match pattern "^/"' }];
                                                return false;
                                              }
                                            } else {
                                              validate20.errors = [{ instancePath: instancePath + "/previousGraphRef/locator", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/properties/locator/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid25 = _errs121 === errors;
                                        } else {
                                          var valid25 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate20.errors = [{ instancePath: instancePath + "/previousGraphRef", schemaPath: "https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Pin/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid3 = _errs109 === errors;
                      } else {
                        var valid3 = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate20.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
export {
  stdin_default as default,
  validate
};
