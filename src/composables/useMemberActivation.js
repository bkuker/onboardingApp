import { ref } from 'vue'
import { gasRun } from '../gasApi'

export function useMemberActivation(token) {
  const searchTerm = ref('')
  const results = ref(null)
  const lastResultsById = ref({})

  const view = ref('search') // 'search' | 'activate'
  const activeContact = ref(null)
  const activating = ref(false)

  async function runSearch() {
    const needle = searchTerm.value.trim()
    results.value = null
    if (!needle) return

    view.value = 'wait'
    const res = await gasRun('search', token, needle)
    lastResultsById.value = Object.fromEntries(res.Contacts.map((c) => [c.Id, c]))
    results.value = res.Contacts
    view.value = 'search'
  }

  async function beginActivation(id) {
    const c = lastResultsById.value[id]
    if (!c) {
      console.error('No cached contact for id', id)
      return
    }
    activeContact.value = c
    view.value = 'wait'
    view.value = 'activate'
  }

  function cancelActivation() {
    activeContact.value = null
    view.value = 'search'
  }

  async function submitActivation({ waiver, memberAgreement, keyCardNumber }) {
    activating.value = true
    try {
      await gasRun(
        'activate',
        token,
        activeContact.value.Id,
        waiver,
        memberAgreement,
        keyCardNumber,
      )
      alert('Activated.')
      // clear stale results since this contact's Status has now changed
      results.value = null
      searchTerm.value = ''
      cancelActivation()
    } catch (err) {
      console.error('Activate error', err)
      alert('Activation failed: ' + err.message)
    } finally {
      activating.value = false
    }
  }

  return {
    searchTerm,
    results,
    view,
    activeContact,
    activating,
    runSearch,
    beginActivation,
    cancelActivation,
    submitActivation,
  }
}
