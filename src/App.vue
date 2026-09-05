<script setup>
import { getBootData } from './gasApi'
import { useMemberActivation } from './composables/useMemberActivation'
import MemberSearch from './components/MemberSearch.vue'
import ActivateForm from './components/ActivateForm.vue'

const boot = getBootData()

const {
  searchTerm,
  results,
  view,
  activeContact,
  problems,
  activating,
  runSearch,
  beginActivation,
  cancelActivation,
  submitActivation,
} = useMemberActivation(boot.token)
</script>

<template>
  <div class="container">
    <h1>New Member Activation Tool</h1>

    <!-- No valid session token: show any error plus the login link. -->
    <template v-if="!boot.token">
      <p v-if="boot.error" class="error">{{ boot.error }}</p>
      <a class="login-link" :href="boot.authUrl">Log in with WildApricot</a>
    </template>

    <div v-else id="app">
      <MemberSearch
        v-if="view === 'search'"
        v-model:searchTerm="searchTerm"
        :results="results"
        @search="runSearch"
        @activate="beginActivation"
      />
      <ActivateForm
         v-if="view === 'activate'"
        :contact="activeContact"
        :problems="problems"
        :activating="activating"
        @submit="submitActivation"
        @cancel="cancelActivation"
      />
      <div v-if="view === 'wait'" class="loader">
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  width: 800px;
  max-width: 100%;
  margin: 0 auto;
  background: white;
  min-height: 100vh;
  padding: 50px;
}

.error {
  color: #b00020;
  background: #fdecea;
  border: 1px solid #f5c2c0;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
}

.login-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #1a73e8;
  color: #fff;
  text-decoration: none;
  border-radius: 4px;
}

h1 {
  background: url('../assets/logo.png') no-repeat;
  background-size: contain;
  padding: 20px 10px 20px 80px;
}

.loader {
  --color-1: #4B4B4B;
  --color-2: #C4C4C4;
  --size: 1px;

  width: calc(48 * var(--size));
  height: calc(48 * var(--size));
  display: block;
  margin: calc(15 * var(--size)) auto;
  position: relative;
  color: var(--color-1);
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
  top: 100px;
}
.loader::after,
.loader::before {
  content: '';
  box-sizing: border-box;
  position: absolute;
  width: calc(24 * var(--size));
  height: calc(24 * var(--size));
  top: 0;
  background-color: var(--color-1);
  border-radius: 50%;
  animation: scale50 1s infinite ease-in-out;
}
.loader::before {
  top: auto;
  bottom: 0;
  background-color: var(--color-2);
  animation-delay: 0.5s;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
@keyframes scale50 {
  0%,
  100% {
    transform: scale(0);
  }
  50% {
    transform: scale(1);
  }
}

</style>

