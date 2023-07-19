import { Application } from '@nocobase/server';
import Database from '@nocobase/database';
import { getApp, sleep } from '..';
import { EXECUTION_STATUS, JOB_STATUS } from '../../constants';

describe('workflow-extensions > instructions > sql', () => {
  let app: Application;
  let db: Database;
  let PostRepo;
  let ReplyRepo;
  let WorkflowModel;
  let workflow;

  beforeEach(async () => {
    app = await getApp();

    db = app.db;
    WorkflowModel = db.getCollection('workflows').model;
    PostRepo = db.getCollection('posts').repository;
    ReplyRepo = db.getCollection('replies').repository;

    workflow = await WorkflowModel.create({
      title: 'test workflow',
      enabled: true,
      type: 'collection',
      config: {
        mode: 1,
        collection: 'posts',
      },
    });
  });

  afterEach(() => db.close());

  describe('invalid', () => {
    it('no sql', async () => {
      const n1 = await workflow.createNode({
        type: 'sql',
        config: {},
      });

      const post = await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [sqlJob] = await execution.getJobs({ order: [['id', 'ASC']] });
      expect(execution.status).toBe(EXECUTION_STATUS.RESOLVED);
      expect(sqlJob.status).toBe(JOB_STATUS.RESOLVED);
    });

    it('empty sql', async () => {
      const n1 = await workflow.createNode({
        type: 'sql',
        config: {
          sql: '',
        },
      });

      const post = await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [sqlJob] = await execution.getJobs({ order: [['id', 'ASC']] });
      expect(execution.status).toBe(EXECUTION_STATUS.RESOLVED);
      expect(sqlJob.status).toBe(JOB_STATUS.RESOLVED);
    });

    it('invalid sql', async () => {
      const n1 = await workflow.createNode({
        type: 'sql',
        config: {
          sql: '1',
        },
      });

      const post = await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [sqlJob] = await execution.getJobs({ order: [['id', 'ASC']] });
      expect(execution.status).toBe(EXECUTION_STATUS.ERROR);
      expect(sqlJob.status).toBe(JOB_STATUS.ERROR);
    });
  });

  describe('sql with variables', () => {
    it('update', async () => {
      const n1 = await workflow.createNode({
        type: 'sql',
        config: {
          sql: `update ${db.options.tablePrefix ?? ''}posts set read={{$context.data.id}} where id={{$context.data.id}}`,
        },
      });

      const n2 = await workflow.createNode({
        type: 'query',
        config: {
          collection: 'posts',
          params: {
            filter: {
              id: '{{ $context.data.id }}',
            }
          }
        },
        upstreamId: n1.id,
      });

      await n1.setDownstream(n2);

      const post = await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [sqlJob, queryJob] = await execution.getJobs({ order: [['id', 'ASC']] });
      expect(sqlJob.status).toBe(JOB_STATUS.RESOLVED);
      expect(queryJob.status).toBe(JOB_STATUS.RESOLVED);
      expect(queryJob.result.read).toBe(post.id);
    });

    it('delete', async () => {
      const n1 = await workflow.createNode({
        type: 'sql',
        config: {
          sql: `delete from ${db.options.tablePrefix ?? ''}posts where id={{$context.data.id}}`,
        },
      });

      const n2 = await workflow.createNode({
        type: 'query',
        config: {
          collection: 'posts',
          params: {
            filter: {
              id: '{{ $context.data.id }}',
            }
          }
        },
        upstreamId: n1.id,
      });

      await n1.setDownstream(n2);

      const post = await PostRepo.create({ values: { title: 't1' } });

      await sleep(500);

      const [execution] = await workflow.getExecutions();
      const [sqlJob, queryJob] = await execution.getJobs({ order: [['id', 'ASC']] });
      expect(sqlJob.status).toBe(JOB_STATUS.RESOLVED);
      expect(queryJob.status).toBe(JOB_STATUS.RESOLVED);
      expect(queryJob.result).toBeNull();
    });
  });
});
