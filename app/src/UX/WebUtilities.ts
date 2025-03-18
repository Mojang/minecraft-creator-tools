export enum BrowserType {
  unknown = 0,
  chrome = 1,
  firefox = 2,
  safari = 3,
  edgeChrome = 4,
}

export default class WebUtilities {
  static getBrowserType() {
    if (navigator.userAgent.indexOf("Edg") >= 0) {
      return BrowserType.edgeChrome;
    } else if (navigator.userAgent.indexOf("hrom") >= 0) {
      return BrowserType.chrome;
    } else if (navigator.userAgent.indexOf("afari") >= 0) {
      return BrowserType.safari;
    } else if (navigator.userAgent.indexOf("irefo") >= 0) {
      return BrowserType.firefox;
    }

    return BrowserType.unknown;
  }

  static getWidth() {
    return Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    );
  }

  static getHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight
    );
  }

  static getElementLeft(element: any) {
    let left = 0;

    do {
      left += (element.offsetLeft as number | undefined) ? (element.offsetLeft as number) : 0;
      element = element.offsetParent as Element | undefined;
    } while (element);

    return left;
  }

  static getElementRight(element: any) {
    let left = this.getElementLeft(element);

    return left + element.offsetWidth;
  }

  static async requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) {
      return false;
    }

    return await navigator.storage.persist();
  }

  static async getIsPersisted() {
    if (!navigator.storage || !navigator.storage.persist) {
      return false;
    }

    return await navigator.storage.persisted();
  }
}
