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
        title: '登录',
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
          meta: {
            title: '控制器管理',
          },
        },
        {
          path: 'networks',
          component: NetworksView,
          meta: {
            title: '网络管理',
          },
        },
        {
          path: 'networks/:controllerId/:networkId',
          component: NetworkDetailView,
          props: true,
          meta: {
            title: '网络详情',
          },
        },
        {
          path: 'test-machines',
          component: TestMachinesView,
          meta: {
            title: '网络测试',
          },
        },
        {
          path: 'users',
          component: UsersView,
          meta: {
            adminOnly: true,
            title: '用户管理',
          },
        },
      ],
    },
  ],
});

router.afterEach((to) => {
  const title = to.meta.title as string | undefined;
  document.title = title ? `${title} - ZT MGMT` : 'ZT MGMT';
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
