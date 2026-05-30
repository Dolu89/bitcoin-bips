import { useFake } from '@japa/plugin-adonisjs/helpers'
import PandocService from '#services/pandoc_service'
import FakePandocService from '#services/fake_pandoc_service'
import type { FakePandocOptions } from '#services/fake_pandoc_service'

/**
 * Swap a deterministic fake for PandocService for the active test so sync-triggered rendering
 * never shells out. Returns the fake for call assertions; auto-restored at test end.
 */
export function useFakePandoc(options: FakePandocOptions = {}): FakePandocService {
  const fake = new FakePandocService(options)
  useFake(PandocService, fake)
  return fake
}
