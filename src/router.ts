import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from './views/HomeView.vue'
import { toolRegistry } from './plugins'
import { createToolRouteComponent } from './plugins/toolRoute'
import LicensesView from './views/LicensesView.vue'

const toolRoutes: RouteRecordRaw[] = toolRegistry.map((tool) => ({
  path: tool.routePath,
  name: tool.id,
  component: createToolRouteComponent(tool),
}))

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/licenses', name: 'licenses', component: LicensesView },
    ...toolRoutes,
  ],
  scrollBehavior: () => ({ top: 0 }),
})
