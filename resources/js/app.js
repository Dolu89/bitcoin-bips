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

// Index page: status filter chips toggle table row visibility.
;(function () {
  const filters = document.querySelector('.bips-filters')
  if (!filters) return

  const chips = filters.querySelectorAll('.bips-chip[data-filter]')
  const countEl = filters.querySelector('.bips-filters__count')
  const tbody = document.querySelector('.bips-table tbody')
  if (!chips.length || !tbody) return

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.filter
      chips.forEach((c) => c.classList.remove('is-active'))
      chip.classList.add('is-active')

      let visible = 0
      tbody.querySelectorAll('tr').forEach((row) => {
        const match = value === 'all' || row.dataset.status === value
        row.style.display = match ? '' : 'none'
        if (match) visible++
      })

      if (countEl) {
        countEl.textContent = `${visible} proposal${visible === 1 ? '' : 's'}`
      }
    })
  })
})()

// Live search overlay: as-you-type results fetched as a bare fragment and injected, with the
// shareable address kept in sync. Seeds itself open when landing on the /search URL with a query.
Alpine.data('searchOverlay', (url) => ({
  url,
  query: '',
  isOpen: false,
  content: '',
  originUrl: '/',
  init() {
    const params = new URLSearchParams(window.location.search)
    const seeded = window.location.pathname === url ? params.get('q') : null
    this.originUrl = seeded ? '/' : window.location.pathname + window.location.search
    if (seeded) {
      this.query = seeded
      this.open()
      this.run()
    }
  },
  async run() {
    this.open()
    const q = this.query.trim()
    const target = q ? `${this.url}?q=${encodeURIComponent(this.query)}` : this.url
    window.history.replaceState(null, '', target)
    try {
      const res = await fetch(target, { headers: { 'X-Requested-With': 'fetch' } })
      if (res.ok) this.content = await res.text()
    } catch (e) {
      /* keep the prior content */
    }
  },
  open() {
    // Pin the overlay just below the sticky header (recomputed on open for responsive headers).
    const header = document.querySelector('.bips-header')
    if (header) {
      document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`)
    }
    this.isOpen = true
    // Lock the page behind so there is a single scrollbar (the overlay's own).
    document.documentElement.style.overflow = 'hidden'
  },
  close() {
    this.isOpen = false
    document.documentElement.style.overflow = ''
    window.history.replaceState(null, '', this.originUrl)
  },
  onOverlayClick(event) {
    const author = event.target.closest('[data-author]')
    if (author) {
      this.query = author.getAttribute('data-author')
      this.run()
      return
    }
    if (event.target.closest('[data-action="clear"]')) {
      this.close()
      return
    }
    const card = event.target.closest('[data-href]')
    if (card) window.location.href = card.getAttribute('data-href')
  },
}))

Alpine.start()
