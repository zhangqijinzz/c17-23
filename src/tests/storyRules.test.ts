import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { deriveScene, getStats, getTimelineWarning, orderedScenes, sanitizeStory, validateName } from '../models/storyRules';

describe('story domain rules', () => {
  it('sorts scenes and calculates unresolved clues', () => {
    const story = createStarterStory();
    story.scenes = [...story.scenes].reverse();
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getStats(story)).toMatchObject({ characters: 2, scenes: 2, clues: 1, unresolvedClues: 1, completion: 80 });
  });

  it('guards invalid names and duplicate timeline orders', () => {
    const story = createStarterStory();
    story.scenes[1].order = story.scenes[0].order;
    expect(validateName(' ')).toBe('至少输入 2 个字');
    expect(getTimelineWarning(story)).toContain('重复');
  });

  it('derives a scene without sharing clue relationships and keeps the source in place', () => {
    const story = createStarterStory();
    const source = story.scenes[0];
    const { story: nextStory, scene: derived } = deriveScene(story, source.id, 'scene-derived');

    expect(orderedScenes(nextStory).map((scene) => scene.id)).toEqual([source.id, 'scene-derived', 'scene-storm']);
    expect(orderedScenes(nextStory).map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(nextStory.selectedSceneId).toBe(source.id);
    expect(derived).toMatchObject({
      title: '旧港口的来信',
      summary: source.summary,
      conflict: source.conflict,
      characterIds: source.characterIds,
      clueIds: [],
      derivedFromSceneId: source.id,
    });
    expect(derived.pendingClues).toEqual([{ clueTitle: '潮汐表背后的日期', role: 'setup' }]);
    expect(nextStory.clues).toHaveLength(1);
    expect(nextStory.clues[0].setupSceneId).toBe(source.id);
    expect(story.scenes.map((scene) => scene.order)).toEqual([1, 2]);
  });

  it('keeps both setup and payoff references when deriving between linked scenes', () => {
    const story = createStarterStory();
    story.clues[0].payoffSceneId = 'scene-storm';
    const { story: derivedStory } = deriveScene(story, 'scene-storm', 'scene-derived');

    expect(orderedScenes(derivedStory).map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(derivedStory.clues[0]).toMatchObject(story.clues[0]);
    expect(derivedStory.scenes.find((scene) => scene.id === 'scene-derived')?.pendingClues).toEqual([
      { clueTitle: '潮汐表背后的日期', role: 'payoff' },
    ]);
  });
  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });
});
