import { test } from '@japa/runner'
import { umamiTag } from '#values/analytics'
import { projects } from '#config/projects'

const bips = projects.find((p) => p.key === 'bips')!
const nips = projects.find((p) => p.key === 'nips')!

test.group('values/analytics', () => {
  test(
    'returns the project Umami tag (src + its own website id) when prod, script URL, and id are present'
  )
    .with([
      { ...bips, analyticsId: 'bips-id' },
      { ...nips, analyticsId: 'nips-id' },
    ])
    .run(({ assert }, project) => {
      const tag = umamiTag(project, { enabled: true, scriptUrl: 'https://u.example/script.js' })

      // Tag carries the configured src and the *passed* project's id (distinct per row → proves selection).
      assert.deepEqual(tag, {
        src: 'https://u.example/script.js',
        websiteId: project.analyticsId,
      })
    })

  test('returns null when analytics is inactive — {label}')
    .with([
      {
        label: 'not production',
        project: { ...bips, analyticsId: 'x' },
        opts: { enabled: false, scriptUrl: 'https://u/script.js' },
      },
      {
        label: 'script URL unset',
        project: { ...bips, analyticsId: 'x' },
        opts: { enabled: true, scriptUrl: null },
      },
      {
        label: 'project has no analytics id',
        project: { ...bips, analyticsId: undefined },
        opts: { enabled: true, scriptUrl: 'https://u/script.js' },
      },
      {
        label: 'no project (unknown host)',
        project: undefined,
        opts: { enabled: true, scriptUrl: 'https://u/script.js' },
      },
    ])
    .run(({ assert }, { project, opts }) => {
      assert.isNull(umamiTag(project, opts))
    })
})
