import { get } from 'lodash';

import { Trigger } from '.';
import Plugin from '..';
import { WorkflowModel } from '../types';
import { Model, modelAssociationByKey } from '@nocobase/database';
import { BelongsTo, HasOne } from 'sequelize';

export default class FormTrigger extends Trigger {
  constructor(plugin: Plugin) {
    super(plugin);

    plugin.app.resourcer.use(this.middleware);
    plugin.app.actions({
      ['workflows:trigger']: this.triggerAction,
    });
  }

  triggerAction = async (context, next) => {
    const { triggerWorkflows } = context.action.params;

    if (!triggerWorkflows) {
      return context.throw(400);
    }

    context.status = 202;
    await next();

    this.trigger(context);
  };

  middleware = async (context, next) => {
    await next();

    const { resourceName, actionName } = context.action;

    if ((resourceName === 'workflows' && actionName === 'trigger') || !['create', 'update'].includes(actionName)) {
      return;
    }

    this.trigger(context);
  };

  async trigger(context) {
    const { triggerWorkflows, values } = context.action.params;
    if (!triggerWorkflows) {
      return;
    }

    const triggers = triggerWorkflows.split(',').map((trigger) => trigger.split('!'));
    const workflowRepo = this.plugin.db.getRepository('workflows');
    const workflows = await workflowRepo.find({
      filter: {
        key: triggers.map((trigger) => trigger[0]),
        current: true,
        type: 'form',
        enabled: true,
      },
    });
    workflows.forEach((workflow) => {
      const trigger = triggers.find((trigger) => trigger[0] == workflow.key);
      if (context.body?.data) {
        const { data } = context.body;
        (Array.isArray(data) ? data : [data]).forEach(async (row: Model) => {
          let payload = row;
          if (trigger[1]) {
            const paths = trigger[1].split('.');
            for await (const field of paths) {
              if (payload.get(field)) {
                payload = payload.get(field);
              } else {
                const association = <HasOne | BelongsTo>modelAssociationByKey(payload, field);
                payload = await payload[association.accessors.get]();
              }
            }
          }
          const { collection, appends = [] } = workflow.config;
          const model = <typeof Model>payload.constructor;
          if (collection !== model.collection.name) {
            return;
          }
          if (appends.length) {
            payload = await model.collection.repository.findOne({
              filterByTk: payload.get(model.primaryKeyAttribute),
              appends,
            });
          }
          this.plugin.trigger(workflow, { data: payload });
        });
      } else {
        this.plugin.trigger(workflow, { data: trigger[1] ? get(values, trigger[1]) : values });
      }
    });
  }

  on(workflow: WorkflowModel) {}

  off(workflow: WorkflowModel) {}
}
