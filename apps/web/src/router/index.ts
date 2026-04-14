import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/auth/login.vue';
import ControllersView from '../views/controllers/index.vue';
import NetworksView from '../views/networks/index.vue';
import NetworkDetailView from '../views/networks/detail.vue';
import AppLayout from '../layouts/AppLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: LoginView,
      meta: {
        public: true,
      },
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          redirect: '/controllers',
        },
        {
          path: 'controllers',
          component: ControllersView,
        },
        {
          path: 'networks',
          component: NetworksView,
        },
        {
          path: 'networks/:controllerId/:networkId',
          component: NetworkDetailView,
          props: true,
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();

  if (to.meta.public) {
    if (authStore.isAuthenticated && to.path === '/login') {
      return '/controllers';
    }
    return true;
  }

  if (!authStore.isAuthenticated) {
    return '/login';
  }

  return true;
});

export default router;
