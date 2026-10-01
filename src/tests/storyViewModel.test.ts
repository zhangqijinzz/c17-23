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

  it('derives a scene without sharing clue relations and keeps the source selected', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const source = viewModel.snapshot.story!.scenes[0];
    viewModel.selectScene(source.id);

    viewModel.deriveScene(source.id);

    const story = viewModel.snapshot.story!;
    const ordered = [...story.scenes].sort((a, b) => a.order - b.order);
    const derived = ordered[1];
    expect(story.scenes).toHaveLength(3);
    expect(derived.id).not.toBe(source.id);
    expect(derived.title).toContain(source.title);
    expect(derived.summary).toBe(source.summary);
    expect(derived.conflict).toBe(source.conflict);
    expect(derived.characterIds).toEqual(source.characterIds);
    // 编号连续且插入在原场景之后
    expect(ordered.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(ordered[0].id).toBe(source.id);
    // 伏笔关系不共用：新场景不带任何伏笔，原伏笔仍只属于原场景
    expect(derived.clueIds).toEqual([]);
    expect(story.clues).toHaveLength(1);
    expect(story.clues[0].setupSceneId).toBe(source.id);
    expect(viewModel.snapshot.notice).toContain('重新建立');
    // 原来选中的那一幕仍在原位
    expect(story.selectedSceneId).toBe(source.id);
  });
});
