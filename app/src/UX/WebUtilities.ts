export default class WebUtilities {
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

  static async requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) {
      return;
    }

    return await navigator.storage.persist();
  }

  static async getIsPersisted() {
    if (!navigator.storage || !navigator.storage.persist) {
      return;
    }

    return await navigator.storage.persisted();
  }
}
