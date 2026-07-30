import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from './views/HomeView.vue'
import { toolRegistry } from './tools/registry'

const toolRoutes: RouteRecordRaw[] = toolRegistry.map((tool) => ({
  path: tool.routePath,
  name: tool.id,
  component: tool.component,
}))

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    ...toolRoutes,
  ],
  scrollBehavior: () => ({ top: 0 }),
})
