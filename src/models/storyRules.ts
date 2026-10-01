import { createId, type StoryDocument, type StoryScene, type StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

export interface DerivedSceneResult {
  story: StoryDocument;
  scene: StoryScene;
  droppedClueTitles: string[];
}

export function deriveSceneFrom(story: StoryDocument, sourceSceneId: string): DerivedSceneResult | null {
  const source = story.scenes.find((scene) => scene.id === sourceSceneId);
  if (!source) return null;
  // 伏笔关系不随派生复制：一条伏笔只能属于一组场景，复制会让两幕共用同一条关系，改一处动两处。
  const scene: StoryScene = {
    id: createId('scene'),
    title: `${source.title}（派生）`,
    order: source.order + 1,
    summary: source.summary,
    conflict: source.conflict,
    characterIds: [...source.characterIds],
    clueIds: [],
  };
  const scenes = orderedScenes(story);
  scenes.splice(scenes.findIndex((item) => item.id === sourceSceneId) + 1, 0, scene);
  const droppedClueTitles = story.clues
    .filter((clue) => source.clueIds.includes(clue.id) || clue.setupSceneId === sourceSceneId || clue.payoffSceneId === sourceSceneId)
    .map((clue) => clue.title);
  return {
    story: {
      ...story,
      scenes: scenes.map((item, sceneIndex) => ({ ...item, order: sceneIndex + 1 })),
      selectedSceneId: sourceSceneId,
    },
    scene,
    droppedClueTitles,
  };
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => clue.payoffSceneId === '').length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
    scenes: story.scenes.length,
    clues: story.clues.length,
    unresolvedClues,
    completion,
  };
}

export function validateName(value: string): string {
  const cleanValue = value.trim();
  return cleanValue.length < 2 ? '至少输入 2 个字' : cleanValue;
}

export function getTimelineWarning(story: StoryDocument): string | null {
  const orders = story.scenes.map((scene) => scene.order);
  return new Set(orders).size !== orders.length ? '时间线存在重复顺序，请重新排列。' : null;
}

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.scenes) ||
    !Array.isArray(candidate.clues)
  ) {
    return null;
  }
  return candidate as StoryDocument;
}
