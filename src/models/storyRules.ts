import type { PendingCluePrompt, StoryDocument, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

export interface DerivedScene {
  story: StoryDocument;
  scene: StoryScene;
}

export function deriveScene(story: StoryDocument, sourceSceneId: string, newSceneId: string): DerivedScene {
  const ordered = orderedScenes(story);
  const sourceIndex = ordered.findIndex((scene) => scene.id === sourceSceneId);
  if (sourceIndex < 0) throw new Error('找不到要派生的场景');

  const pendingClues = story.clues.flatMap((clue) => {
    const prompts: PendingCluePrompt[] = [];
    if (clue.setupSceneId === sourceSceneId) {
      prompts.push({ clueTitle: clue.title, role: 'setup' });
    }
    if (clue.payoffSceneId === sourceSceneId) {
      prompts.push({ clueTitle: clue.title, role: 'payoff' });
    }
    return prompts;
  });

  const source = ordered[sourceIndex];
  const derivedScene: StoryScene = {
    id: newSceneId,
    title: source.title,
    order: sourceIndex + 2,
    summary: source.summary,
    conflict: source.conflict,
    characterIds: [...source.characterIds],
    clueIds: [],
    derivedFromSceneId: source.id,
    pendingClues,
  };

  const nextScenes = [...ordered];
  nextScenes.splice(sourceIndex + 1, 0, derivedScene);
  const reindexedScenes = nextScenes.map((scene, index) => ({
    ...scene,
    order: index + 1,
    characterIds: [...scene.characterIds],
    clueIds: [...scene.clueIds],
    pendingClues: scene.pendingClues?.map((prompt) => ({ ...prompt })),
  }));

  return {
    story: {
      ...story,
      scenes: reindexedScenes,
      clues: story.clues,
    },
    scene: reindexedScenes[sourceIndex + 1],
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
