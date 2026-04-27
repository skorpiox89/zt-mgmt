import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/auth/login.vue';
import ControllersView from '../views/controllers/index.vue';
import NetworksView from '../views/networks/index.vue';
import NetworkDetailView from '../views/networks/detail.vue';
import TestMachinesView from '../views/test-machines/index.vue';
import UsersView from '../views/users/index.vue';
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
        {
          path: 'test-machines',
          component: TestMachinesView,
        },
        {
          path: 'users',
          component: UsersView,
          meta: {
            adminOnly: true,
          },
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

  if (to.meta.adminOnly && !authStore.isAdmin) {
    return '/controllers';
  }

  return true;
});

export default router;
