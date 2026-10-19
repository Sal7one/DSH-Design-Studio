import { runtime } from './runtime.js'
import { DS_CSS, installCss } from './styles.js'
import { labelsEn, labelsZh } from './labels.js'
import { StudioView } from './studio-view.js'
import { SettingsView, AllDesignsView } from './settings.js'

export const inject = ['slots']

export function apply(ctx) {
  const slots = ctx.slots
  if (slots === undefined) return

  runtime.ctx = ctx

  // Optional locale seat: the tab/section labels follow the active language
  // without a remount. The rest of the studio UI is English-only.
  let t = (key) => labelsEn[key] || key
  const locale = ctx.get('locale')
  if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
    ctx.effect(() => locale.register('dsh-design-studio', 'en', labelsEn))
    ctx.effect(() => locale.register('dsh-design-studio', 'zh', labelsZh))
    t = locale.bind('dsh-design-studio')
  }
  runtime.t = t

  // One style tag for the plugin's classes; owned by apply(), not the factory.
  if (typeof document !== 'undefined') {
    ctx.effect(() => installCss(DS_CSS))
  }

  slots.inject('conversation.view', () =>
    slots.register({
      name: 'conversation.view',
      id: 'design-studio',
      order: 20,
      label: () => t('tab.designStudio'),
    }, StudioView),
  )
  slots.inject('settings.section', () =>
    slots.register({ name: 'settings.section', id: 'all-designs', order: 14, label: () => t('section.allDesigns') }, AllDesignsView),
  )
  slots.inject('settings.section', () =>
    slots.register({ name: 'settings.section', id: 'design-studio', order: 25, label: () => t('section.designStudio') }, SettingsView),
  )
}
