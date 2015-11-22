/// <reference path="./Tools.ts" />
/// <reference path="./StackFrame.ts" />
module AngularAppInsights {
   export class StackParser {
        /*
        * Stack parsing by the stacktracejs project @ https://github.com/stacktracejs/error-stack-parser
        */
        private _tools: Tools;
        private FIREFOX_SAFARI_STACK_REGEXP = /\S+\:\d+/;
        private CHROME_IE_STACK_REGEXP = /\s+at /;


        constructor(tools: Tools) {
            this._tools=tools;
        }
        
        /**
        * Given an Error object, extract the most information from it.
        * @param error {Error}
        * @return Array[StackFrame]
        */
        parse(error) {
            if (typeof error.stacktrace !== 'undefined' || typeof error['opera#sourceloc'] !== 'undefined') {
                return this.parseOpera(error);
            } else if (error.stack && error.stack.match(this.CHROME_IE_STACK_REGEXP)) {
                return this.parseV8OrIE(error);
            } else if (error.stack && error.stack.match(this.FIREFOX_SAFARI_STACK_REGEXP)) {
                return this.parseFFOrSafari(error);
            } else {
                return null;
            }
        }

        /**
        * Separate line and column numbers from a URL-like string.
        * @param urlLike String
        * @return Array[String]
        */
        extractLocation(urlLike) {
            // Guard against strings like "(native)"
            if (urlLike.indexOf(':') === -1) {
                return [];
            }

            var locationParts = urlLike.split(':');
            var lastNumber = locationParts.pop();
            var possibleNumber = locationParts[locationParts.length - 1];
            if (!isNaN(parseFloat(possibleNumber)) && isFinite(possibleNumber)) {
                var lineNumber = locationParts.pop();
                return [locationParts.join(':'), lineNumber, lastNumber];
            } else {
                return [locationParts.join(':'), lastNumber, undefined];
            }
        }

        parseV8OrIE(error) {
            var level = 0;
            return error.stack.split('\n').slice(1).map((line)=> {
                var tokens = line.replace(/^\s+/, '').split(/\s+/).slice(1);
                var locationParts = tokens[0] !== undefined ? this.extractLocation(tokens.pop().replace(/[\(\)\s]/g, '')) : ['unknown', 'unknown', 'unknown'];
                var functionName = (!tokens[0] || tokens[0] === 'Anonymous') ? 'unknown' : tokens[0];
                return new StackFrame(functionName, undefined, locationParts[0], locationParts[1], locationParts[2], level++,this._tools);
            }, this);
        }

        parseFFOrSafari(error) {
            var level = 0;
            return error.stack.split('\n').filter((line)=> {
                return !!line.match(this.FIREFOX_SAFARI_STACK_REGEXP);
            }, this).map((line)=> {
                var tokens = line.split('@');
                var locationParts = this.extractLocation(tokens.pop());
                var functionName = tokens.shift() || 'unknown';
                return new StackFrame(functionName, undefined, locationParts[0], locationParts[1], locationParts[2], level++,this._tools);
            }, this);
        }

        parseOpera(e) {
            if (!e.stacktrace || (e.message.indexOf('\n') > -1 &&
                e.message.split('\n').length > e.stacktrace.split('\n').length)) {
                return this.parseOpera9(e);
            } else if (!e.stack) {
                return this.parseOpera10(e);
            } else {
                return this.parseOpera11(e);
            }
        }

        parseOpera9(e) {
            var lineRE = /Line (\d+).*script (?:in )?(\S+)/i;
            var lines = e.message.split('\n');
            var result = [];
            var level = 0;
            for (var i = 2, len = lines.length; i < len; i += 2) {
                var match = lineRE.exec(lines[i]);
                if (match) {
                    result.push(new StackFrame(undefined, undefined, match[2], match[1], undefined, level++,this._tools));
                }
            }

            return result;
        }

        parseOpera10(e) {
            var lineRE = /Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i;
            var lines = e.stacktrace.split('\n');
            var result = [];
            var level = 0;
            for (var i = 0, len = lines.length; i < len; i += 2) {
                var match = lineRE.exec(lines[i]);
                if (match) {
                    result.push(new StackFrame(match[3] || undefined, undefined, match[2], match[1], undefined, level++,this._tools));
                }
            }

            return result;
        }

        // Opera 10.65+ Error.stack very similar to FF/Safari
        parseOpera11(error) {
            var level = 0;
            return error.stack.split('\n').filter(function (line) {
                return !!line.match(this.FIREFOX_SAFARI_STACK_REGEXP) &&
                    !line.match(/^Error created at/);
            }, this).map(function (line) {
                var tokens = line.split('@');
                var locationParts = this.extractLocation(tokens.pop());
                var functionCall = (tokens.shift() || '');
                var functionName = functionCall
                    .replace(/<anonymous function(: (\w+))?>/, '$2')
                    .replace(/\([^\)]*\)/g, '') || undefined;
                var argsRaw;
                if (functionCall.match(/\(([^\)]*)\)/)) {
                    argsRaw = functionCall.replace(/^[^\(]+\(([^\)]*)\)$/, '$1');
                }
                var args = (argsRaw === undefined || argsRaw === '[arguments not available]') ? undefined : argsRaw.split(',');
                return new StackFrame(functionName, args, locationParts[0], locationParts[1], locationParts[2], level++,this._tools);
            }, this);
        }

    }
}


