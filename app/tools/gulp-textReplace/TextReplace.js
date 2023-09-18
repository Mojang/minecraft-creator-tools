class TextReplace {
  _fromRegx;
  _toStr;

  constructor(fromRegEx, toStr) {
    this._fromRegEx = fromRegEx;
    this._toStr = toStr;
  }

  static create(root, aliases = {}) {
    return new TextReplace(root, aliases);
  }

  resolve(filePath, content) {
    if (Array.isArray(this._fromRegEx) && Array.isArray(this._toStr) && this._fromRegEx.length === this._toStr.length) {
      for (let i = 0; i < this._fromRegEx.length; i++) {
        content = content.replace(this._fromRegEx[i], this._toStr[i]);
      }

      return content;
    }

    return content.replace(this._fromRegEx, this._toStr);
  }
}

module.exports = TextReplace;
