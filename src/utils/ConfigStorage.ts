import { Config } from '../types/config';

const OPFS_FILENAME = 'config.json';

/**
 * Persistence layer for the user's active configuration, backed exclusively
 * by the Origin Private File System (OPFS).
 *
 * OPFS gives each origin a private directory managed by the browser, invisible
 * to the user but accessible via navigator.storage.getDirectory(). The config
 * is stored as a single 'config.json' file inside that directory. OPFS is
 * async, has no practical size limit, and is the semantically correct API for
 * "save a file" in the browser. It is available in Chrome 86+, Firefox 111+,
 * and Safari 15.2+, covering over 98% of users as of 2026. It works with no
 * backend and no special HTTP headers, and is fully compatible with GitHub
 * Pages.
 *
 * The application performs an availability check at startup via
 * `checkAvailability()` and shows a blocking error screen when OPFS is
 * absent, so all other methods in this module can assume OPFS is present.
 */

/**
 * Checks whether OPFS is available in this browser.
 * Returns true when the API is present and a directory handle can be obtained.
 * Must be called once at application startup before any other ConfigStorage
 * method is used.
 */
export const checkOpfsAvailability = async (): Promise<boolean> => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.storage?.getDirectory !== 'function'
  ) {
    return false;
  }
  try {
    await navigator.storage.getDirectory();
    return true;
  } catch {
    return false;
  }
};

const getOpfsRoot = (): Promise<FileSystemDirectoryHandle> =>
  navigator.storage.getDirectory();

export const ConfigStorage = {
  /**
   * Loads the user-saved configuration from OPFS.
   * Returns null when no saved configuration exists.
   * Throws on unexpected read or parse errors.
   */
  load: async (): Promise<Config | null> => {
    try {
      const root = await getOpfsRoot();
      const fileHandle = await root.getFileHandle(OPFS_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as Config;
    } catch (err) {
      // getFileHandle throws a NotFoundError when the file does not exist yet.
      // That is the expected state on first launch — return null.
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return null;
      }
      throw err;
    }
  },

  /**
   * Saves the given configuration to OPFS.
   * Overwrites any previously saved configuration.
   */
  save: async (config: Config): Promise<void> => {
    const root = await getOpfsRoot();
    const fileHandle = await root.getFileHandle(OPFS_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(config, null, 2));
    await writable.close();
  },

  /**
   * Removes the saved configuration from OPFS.
   * After calling this, the application will initialise with the built-in
   * default configuration on the next load.
   */
  clear: async (): Promise<void> => {
    try {
      const root = await getOpfsRoot();
      await root.removeEntry(OPFS_FILENAME);
    } catch (err) {
      // Ignore NotFoundError — the file was already absent.
      if (err instanceof DOMException && err.name === 'NotFoundError') return;
      throw err;
    }
  },

  /**
   * Returns true when a user-saved configuration exists in OPFS.
   */
  hasSaved: async (): Promise<boolean> => {
    try {
      const root = await getOpfsRoot();
      await root.getFileHandle(OPFS_FILENAME);
      return true;
    } catch {
      return false;
    }
  },
};