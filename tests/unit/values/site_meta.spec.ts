import { test } from '@japa/runner'
import { resolveMeta, iconPaths } from '#values/site_meta'
import { projects } from '#config/projects'

const bips = projects.find((p) => p.key === 'bips')!
const nips = projects.find((p) => p.key === 'nips')!

test.group('values/site_meta', () => {
  test(
    'home page: full-name-led title, project description, absolute canonical + og:image, large card'
  )
    .with([bips, nips])
    .run(({ assert }, project) => {
      const meta = resolveMeta({ project, path: '/' })

      // No page title → the home title leads with the full name and carries the acronym; both come
      // from the project, so the exact marketing tail is policy we don't pin here.
      assert.isTrue(meta.title.startsWith(project.fullName))
      assert.include(meta.title, project.name)
      assert.equal(meta.siteName, project.name)
      assert.equal(meta.description, project.description)
      assert.equal(meta.canonical, `https://${project.domain}/`)
      // og:image resolves to an absolute URL on the project's own domain.
      assert.equal(meta.ogImage, `https://${project.domain}${project.ogImage}`)
      assert.equal(meta.ogType, 'website')
      assert.equal(meta.twitterCard, 'summary_large_image')
      assert.equal(meta.themeColor, project.color)
    })

  test(
    'inner page: "<title> — <full name>", overrides description + ogType, canonical carries the path'
  )
    .with([bips, nips])
    .run(({ assert }, project) => {
      const meta = resolveMeta({
        project,
        path: '/42',
        title: `${project.specLabel} 42 - Example`,
        description: 'A specific page.',
        ogType: 'article',
      })

      // Inner pages suffix the expanded brand name (lifts short spec titles into the optimal range).
      assert.equal(meta.title, `${project.specLabel} 42 - Example — ${project.fullName}`)
      assert.equal(meta.description, 'A specific page.')
      assert.equal(meta.canonical, `https://${project.domain}/42`)
      assert.equal(meta.ogType, 'article')
    })

  test('canonical drops query/hash and trailing slashes', ({ assert }) => {
    assert.equal(
      resolveMeta({ project: bips, path: '/42/?q=x#frag' }).canonical,
      `https://${bips.domain}/42`
    )
    assert.equal(resolveMeta({ project: bips, path: '/' }).canonical, `https://${bips.domain}/`)
  })

  test('no project (unknown host): generic title, no canonical/image, plain summary card', ({
    assert,
  }) => {
    const meta = resolveMeta({ path: '/' })

    assert.equal(meta.title, 'Specs')
    assert.isNull(meta.canonical)
    assert.isNull(meta.ogImage)
    assert.equal(meta.twitterCard, 'summary')
    assert.isNull(meta.themeColor)
  })

  test('iconPaths are derived from the project key', ({ assert }) => {
    assert.deepEqual(iconPaths('bips'), {
      ico: '/favicon.ico',
      svg: '/icons/bips/favicon.svg',
      png32: '/icons/bips/icon-32.png',
      apple: '/icons/bips/icon-180.png',
      manifest: '/icons/bips/site.webmanifest',
    })
  })
})
