
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import fs from 'fs/promises';
import path from 'path';

const toolForgeRoutes = new Hono();

const forgeRequestSchema = z.object({
  description: z.string().min(10),
});

toolForgeRoutes.post('/tool-forge', zValidator('json', forgeRequestSchema), async (c) => {
  const { description } = c.req.valid('json');
  
  // Basic skill name generation
  const skillName = description.toLowerCase().split(' ').slice(0, 4).join('-').replace(/[^a-z0-9-]/g, '');

  const skillContent = `
# ${skillName}

## Description
${description}

## Installation
\`\`\`bash
# Installation instructions go here
\`\`\`

## Usage
\`\`\`bash
# Usage examples go here
\`\`\`
  `.trim();

  const mockResponse = {
    skillName,
    files: [{
      path: `${skillName}/SKILL.md`,
      content: skillContent,
    }],
    instructions: `1. Review the generated SKILL.md.\n2. Add any required scripts.\n3. Test thoroughly.`,
  };

  return c.json(mockResponse);
});

const installRequestSchema = z.object({
    skillName: z.string(),
    files: z.array(z.object({
        path: z.string(),
        content: z.string(),
    })),
});

toolForgeRoutes.post('/tool-forge/install', zValidator('json', installRequestSchema), async (c) => {
    const { skillName, files } = c.req.valid('json');
    const skillsDir = path.join(process.env.HOME || '~', '.openclaw/workspace/skills', skillName);

    try {
        await fs.mkdir(skillsDir, { recursive: true });
        for (const file of files) {
            const filePath = path.join(skillsDir, path.basename(file.path));
            await fs.writeFile(filePath, file.content);
        }
        return c.json({ success: true, message: `Skill '${skillName}' installed successfully.` });
    } catch (error) {
        console.error("Failed to install skill:", error);
        return c.json({ success: false, message: 'Failed to install skill.' }, 500);
    }
});


export { toolForgeRoutes };
