import { Collection, defineCollection } from '@nocobase/database';
import { InstallOptions, Plugin } from '@nocobase/server';
import { antd, compact, compactDark, dark } from './builtinThemes';

export class ThemeEditorPlugin extends Plugin {
  theme: Collection<any, any>;

  afterAdd() {}

  beforeLoad() {}

  async load() {
    this.theme = this.db.collection(
      defineCollection({
        name: 'themeConfig',
        fields: [
          // 主题配置内容，一个 JSON 字符串
          {
            type: 'json',
            name: 'config',
          },
          // 主题是否可选
          {
            type: 'boolean',
            name: 'optional',
          },
          {
            type: 'boolean',
            name: 'isBuiltIn',
          },
        ],
      }),
    );
  }

  async install(options?: InstallOptions) {
    if ((await this.theme.repository.count()) === 0) {
      await this.theme.repository.create({
        values: [antd, dark, compact, compactDark],
      });
    }
  }

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default ThemeEditorPlugin;
