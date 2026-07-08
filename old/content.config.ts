import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { file } from 'astro/loaders';

const interaction = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('type'),
		prompt: z.string(),
		hint: z.string(),
		glyph: z.string(),
		key: z.string(),
		success: z.string(),
	}),
	z.object({
		type: z.literal('trace'),
		prompt: z.string(),
		hint: z.string(),
		shape: z.enum(['spiral', 'beak', 'release', 'river']),
		success: z.string(),
	}),
]);

const story = defineCollection({
	loader: file('src/data/story.json'),
	schema: z.object({
		id: z.string(),
		order: z.number(),
		chapter: z.string(),
		theme: z.enum(['dusk', 'belly', 'marsh', 'shadow', 'hearth', 'river']),
		lines: z.array(z.string()),
		interaction: interaction.optional(),
	}),
});

export const collections = { story };
