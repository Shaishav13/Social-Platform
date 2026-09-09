import { SearchDatabase } from './database';

export { SearchModel } from './models';
export { default as searchRoutes } from './routes';
export * from './types';

export const SearchService = {
  async initialize(): Promise<void> {
    await SearchDatabase.initializeTables();
  }
};