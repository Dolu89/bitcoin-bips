import { exec } from "node:child_process";
import path from "node:path";
import fs from "fs/promises"

export default class TypeConverterService {

    async fromMediaWikiToMarkdown(content: string): Promise<string> {
        // Create tmp file
        const tempFilePath = path.join("./tmp", 'temp.mediawiki');

        // Write content to this file
        await fs.writeFile(tempFilePath, content, 'utf8');

        return new Promise((resolve, reject) => {
            exec(
                `pandoc "${tempFilePath}" -f mediawiki -t gfm`,
                async (error, stdout, stderr) => {
                    // Delete tmp file
                    await fs.unlink(tempFilePath);

                    if (error) {
                        reject(`error: ${error}`);
                    }

                    if (stdout) {
                        resolve(stdout)
                    }

                    if (stderr) {
                        reject(stderr);
                    }
                },
            );
        });
    }

}