import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { deriveSceneFrom, getStats, getTimelineWarning, orderedScenes, sanitizeStory, validateName } from '../models/storyRules';

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

  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });

  it('derives a scene after the source and drops clue links without touching existing clues', () => {
    const story = createStarterStory();
    story.clues.push({ id: 'clue-compass', title: '铜罗盘', setupSceneId: 'scene-storm', payoffSceneId: 'scene-old-harbor' });
    story.scenes[1].clueIds.push('clue-compass');

    const result = deriveSceneFrom(story, 'scene-storm')!;

    expect(result.scene.title).toBe('风暴前夜（派生）');
    expect(result.scene.summary).toBe(story.scenes[1].summary);
    expect(result.scene.conflict).toBe(story.scenes[1].conflict);
    expect(result.scene.characterIds).toEqual(story.scenes[1].characterIds);
    expect(result.scene.clueIds).toEqual([]);
    expect(result.droppedClueTitles).toEqual(['铜罗盘']);
    // 新场景插在原场景之后，编号重新连续
    const ordered = orderedScenes(result.story);
    expect(ordered.map((scene) => scene.id)).toEqual(['scene-old-harbor', 'scene-storm', result.scene.id]);
    expect(ordered.map((scene) => scene.order)).toEqual([1, 2, 3]);
    // 既有伏笔的埋下/回收指向不变，不与新场景共用
    expect(result.story.clues).toHaveLength(2);
    expect(result.story.clues[1]).toMatchObject({ setupSceneId: 'scene-storm', payoffSceneId: 'scene-old-harbor' });
    expect(result.story.selectedSceneId).toBe('scene-storm');
    expect(deriveSceneFrom(story, 'missing-scene')).toBeNull();
  });
});
