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
  /*
  static getByteArrayFromFile(file : Blob) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();

        reader.readAsArrayBuffer(file);

        reader.onloadend = (evt) => {
          if (evt.target && evt.target.readyState === FileReader.DONE) {
            const arrayBuffer = evt.target.result;
            if (arrayBuffer instanceof ArrayBuffer) {
              const array = new Uint8Array(arrayBuffer);

              resolve(array);
            }
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }*/
}
