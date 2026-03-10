import { Router } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";

const router = Router();

const memoryPath = path.join(os.homedir(), ".openclaw/workspace/memory");

router.get("/entries", async (req, res) => {
  try {
    const files = await fs.promises.readdir(memoryPath);
    const mdFiles = files.filter((file) => file.endsWith(".md"));

    const entries = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(memoryPath, file);
        const stat = await fs.promises.stat(filePath);
        const content = await fs.promises.readFile(filePath, "utf-8");
        return {
          filename: file,
          date: file.replace(".md", ""),
          sizeBytes: stat.size,
          preview: content.substring(0, 100),
        };
      })
    );

    res.json(entries.sort((a, b) => b.date.localeCompare(a.date)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to read journal entries" });
  }
});

router.get("/entry", async (req, res) => {
  const { file } = req.query;
  if (typeof file !== "string") {
    return res.status(400).json({ error: "File parameter is required" });
  }

  try {
    const filePath = path.join(memoryPath, file);
    const content = await fs.promises.readFile(filePath, "utf-8");
    res.json({ filename: file, content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to read journal entry" });
  }
});

router.post("/entry", async (req, res) => {
  const { filename, content } = req.body;

  if (!filename || !content) {
    return res.status(400).json({ error: "Filename and content are required" });
  }

  try {
    const filePath = path.join(memoryPath, filename);
    await fs.promises.appendFile(filePath, content);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update journal entry" });
  }
});

router.get("/search", (req, res) => {
  const { q } = req.query;
  if (typeof q !== "string") {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  const command = `grep -ri "${q}" ${memoryPath}`;

  exec(command, (error, stdout, stderr) => {
    if (error && !stdout) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: "Failed to search journal entries" });
    }

    const results = stdout
      .split("\n")
      .filter((line) => line)
      .map((line) => {
        const [file, ...rest] = line.split(":");
        const content = rest.join(":");
        return {
          file: path.basename(file),
          line: content,
          lineNumber: 0, // grep -n would be needed for this
          context: content,
        };
      })
      .slice(0, 50);

    res.json(results);
  });
});

export default router;

export const journalRoutes = router;
