// Zgodba se na računalniku drsi (ScrollStory), na telefonu pa lista kot »stories« (SwipeStory).
// Način in položaj v celi zgodbi poda stran (GrafiView); poglavje samo izbere pravo komponento.
import { computed } from 'vue'
import ScrollStory from '@/components/ScrollStory.vue'
import SwipeStory from '@/components/SwipeStory.vue'

export interface NacinZgodbe {
  nacin?: 'scroll' | 'swipe'
  pred?: number // korakov v prejšnjih poglavjih
  skupaj?: number // vseh korakov
  zacniNaKoncu?: boolean // ob vrnitvi nazaj začni na zadnjem koraku
}

export function useNacinZgodbe(props: NacinZgodbe) {
  const swipe = computed(() => props.nacin === 'swipe')
  const komponenta = computed(() => (swipe.value ? SwipeStory : ScrollStory))
  // dodatne lastnosti samo za SwipeStory (ScrollStory jih ne pozna)
  const vezave = computed(() =>
    swipe.value ? { pred: props.pred ?? 0, skupaj: props.skupaj ?? 0, zacniNaKoncu: props.zacniNaKoncu ?? false } : {},
  )
  return { swipe, komponenta, vezave }
}
