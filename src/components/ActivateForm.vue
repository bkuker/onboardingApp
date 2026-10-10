<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  contact: { type: Object, default: null },
  problems: { type: Array, default: () => [] },
  activating: { type: Boolean, default: false },
})
const emit = defineEmits(['submit', 'cancel'])

const waiver = ref(false)
const memberAgreement = ref(false)
const keyCardNumber = ref('')

// Reset the form whenever a new contact comes in for activation
watch(
  () => props.contact,
  () => {
    waiver.value = false
    memberAgreement.value = false
    keyCardNumber.value = ''
  },
)

const hasProblems = computed(() => props.problems.length > 0)

function onSubmit() {
  if (!waiver.value || !memberAgreement.value) {
    alert('Both Waiver and Member Agreement must be confirmed.')
    return
  }
  const card = keyCardNumber.value.trim()
  if (!/^\d{8}$/.test(card)) {
    alert('Key Card Number must be exactly 8 digits.')
    return
  }
  emit('submit', {
    waiver: waiver.value,
    memberAgreement: memberAgreement.value,
    keyCardNumber: keyCardNumber.value.trim(),
  })
}
</script>

<template>
  <div id="activate" v-if="contact">
    <fieldset>
      <legend>Activate <span id="name">{{ contact?.FirstName }} {{ contact?.LastName }}</span></legend>

      <ul id="problemList" v-if="hasProblems">
        <li v-for="p in problems" :key="p">{{ p }}</li>
      </ul>

      <label for="waiverCheck">Signed Waiver:</label>
      <input id="waiverCheck" v-model="waiver" type="checkbox" name="waiver" :disabled="hasProblems" />
      <br />

      <label for="memberAgreementCheck">Signed Member Agreement:</label>
      <input
        id="memberAgreementCheck"
        v-model="memberAgreement"
        type="checkbox"
        name="memberAgreement"
        :disabled="hasProblems"
      />
      <br />

      <label for="keyCardNumber">Key Card Number:</label>
      <input
        id="keyCardNumber"
        v-model="keyCardNumber"
        type="text"
        name="keyCardNumber"
        inputmode="numeric"
        autocomplete="off"
        :disabled="hasProblems"
      />
      <p class="keyHelp">
        Key Card: Last 8 digits.<br>
        Key Fob: 175xxxxx using number from fob.
      </p>

      <button id="activateSubmitBtn" :disabled="hasProblems || activating" @click="onSubmit">
        {{ activating ? 'Activating…' : 'Activate' }}
      </button>
      <button id="cancelActivateBtn" type="button" @click="emit('cancel')">Cancel</button>
    </fieldset>
  </div>
</template>

<style scoped>
#problemList {
  list-style: none;
}

#problemList li::before {
  content: "✕";
  color: red;
  margin-right: 0.5em;
}

#activate label {
  width: 250px;
  display: inline-block;
  font-weight: bold;
}
#activate label,
#activate input,
#activate button {
  margin-top: 20px;
  margin-left: 20px;
}

.keyHelp {
  font-style: italic;
  padding-left: 290px;
}
</style>

