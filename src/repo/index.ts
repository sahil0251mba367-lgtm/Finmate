import { ANDROID_FILES_PART_1 } from './androidFilesPart1';
import { ANDROID_FILES_PART_2 } from './androidFilesPart2';
import { ANDROID_FILES_PART_3 } from './androidFilesPart3';
import { RepoFileEntry } from '../utils/zipBuilder';

export const ALL_ANDROID_REPO_FILES: RepoFileEntry[] = [
  ...ANDROID_FILES_PART_1,
  ...ANDROID_FILES_PART_2,
  ...ANDROID_FILES_PART_3,
];
