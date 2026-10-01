import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('derives the selected scene and leaves its clue relationships as rebuild prompts', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    const source = viewModel.snapshot.story!.scenes[0];
    viewModel.selectScene(source.id);
    viewModel.deriveScene(source.id);

    const story = viewModel.snapshot.story!;
    const derived = story.scenes.find((scene) => scene.derivedFromSceneId === source.id)!;
    expect(viewModel.selectedScene?.id).toBe(source.id);
    expect(story.scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(derived.title).toBe('旧港口的来信');
    expect(derived.summary).toBe(source.summary);
    expect(derived.conflict).toBe(source.conflict);
    expect(derived.characterIds).toEqual(source.characterIds);
    expect(derived.clueIds).toEqual([]);
    expect(derived.pendingClues).toEqual([{ clueTitle: '潮汐表背后的日期', role: 'setup' }]);
    expect(story.clues).toHaveLength(1);
    expect(story.clues[0].setupSceneId).toBe(source.id);
    expect(viewModel.snapshot.notice).toContain('重新建立');

    viewModel.selectScene(derived.id);
    viewModel.addClue('潮汐表背后的日期', derived.id, '');
    const rebuilt = viewModel.snapshot.story!.scenes.find((scene) => scene.id === derived.id)!;
    expect(rebuilt.pendingClues).toEqual([]);
    expect(rebuilt.clueIds).toHaveLength(1);
    expect(viewModel.snapshot.story!.clues).toHaveLength(2);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });
});
