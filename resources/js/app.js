import Alpine from 'alpinejs'

Alpine.data('alert', function () {
  return {
    isVisible: false,
    dismiss() {
      this.isVisible = false
    },
    init() {
      setTimeout(() => {
        this.isVisible = true
      }, 80)
      setTimeout(() => {
        this.dismiss()
      }, 5000)
    },
  }
})

// Light/dark toggle: flips `data-theme` on <html> and persists it. Initial theme is set pre-paint in the layout head.
window.toggleTheme = function () {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem('theme', next)
  } catch (e) {
    /* ignore */
  }
}

// "On this page" scroll-spy: highlights the TOC link for the section currently in view.
Alpine.data('scrollSpy', function () {
  return {
    observer: null,
    init() {
      const links = Array.from(this.$el.querySelectorAll('a[href^="#"]'))
      if (!links.length) return
      const byId = new Map(
        links.map((a) => [decodeURIComponent(a.getAttribute('href').slice(1)), a])
      )
      const targets = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean)
      this.observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          if (!visible[0]) return
          links.forEach((a) => a.classList.remove('is-active'))
          byId.get(visible[0].target.id)?.classList.add('is-active')
        },
        { rootMargin: '-96px 0px -62% 0px', threshold: 0 }
      )
      targets.forEach((t) => this.observer.observe(t))
    },
    destroy() {
      this.observer?.disconnect()
    },
  }
})

// Change-history drawer: lazy-loads the commit list, prefetched on idle so opening is instant.
Alpine.data('historyDrawer', (url) => ({
  isOpen: false,
  loaded: false,
  content: '<p class="commits-empty">Loading…</p>',
  init() {
    const prefetch = () => this.load()
    if ('requestIdleCallback' in window) requestIdleCallback(prefetch)
    else setTimeout(prefetch, 1200)
  },
  async load() {
    if (this.loaded) return
    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } })
      if (res.ok) {
        this.content = await res.text()
        this.loaded = true
      }
    } catch (e) {
      /* keep the loading / empty state */
    }
  },
  async open() {
    this.isOpen = true
    if (!this.loaded) await this.load()
  },
  close() {
    this.isOpen = false
  },
}))

Alpine.start()
