export default class ProfilerWrapper {
  static async generateCpuTrace(traceName: string, functionToProfile: () => void | Promise<void>) {
    return new Promise<string>((resolve, reject) => {
      const { Session } = require("inspector");
      const session = new Session();

      try {
        session.connect();

        session.post("Profiler.enable", (err: Error | null) => {
          if (err) return reject(err);

          session.post("Profiler.start", async (err: Error | null) => {
            if (err) return reject(err);

            try {
              await functionToProfile();

              session.post("Profiler.stop", (err: Error | null, result: { profile: unknown }) => {
                session.disconnect();

                if (err) return reject(err);

                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const filename = `${traceName}-profile-${timestamp}.cpuprofile`;

                require("fs").writeFileSync(filename, JSON.stringify(result.profile));
                console.log(`Profile saved to ${filename}`);
                resolve(filename);
              });
            } catch (error) {
              session.disconnect();
              reject(error);
            }
          });
        });
      } catch (error) {
        session.disconnect();
        reject(error);
      }
    });
  }
}
