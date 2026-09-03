<script setup>
defineProps({
  searchTerm: { type: String, default: '' },
  results: { type: Array, default: null },
})
const emit = defineEmits(['update:searchTerm', 'search', 'activate'])

function onKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('search')
  }
}
</script>

<template>
  <div id="search">
    <input
      id="searchTerm"
      :value="searchTerm"
      placeholder="Member Name"
      @input="emit('update:searchTerm', $event.target.value)"
      @keydown="onKeydown"
    />
    <button id="searchButton" @click="emit('search')">Search</button>

    <table v-if="results !== null">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Activate</th>
        </tr>
      </thead>
      <tbody id="results">
        <tr v-for="c in results" :key="c.Id">
          <td>{{ c.FirstName }} {{ c.LastName }}</td>
          <td>{{ c.Email }}</td>
          <td>
            <button v-if="c.Status === 'PendingNew'" @click="emit('activate', c.Id)">
              Activate
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  text-align: left;
  padding: 8px 12px;
}

tbody tr:nth-child(even) {
  background-color: #eee;
}
</style>

