# 🛍️ Tutaviendo - Plataforma de Catálogos WhatsApp

Una plataforma moderna y completa para crear catálogos profesionales de WhatsApp. Permite a los usuarios crear tiendas online, gestionar productos y generar catálogos optimizados para compartir por WhatsApp.

## 🌟 Características Principales

### 🏪 Gestión de Tiendas
- **Múltiples tiendas** según el plan del usuario
- **Personalización completa** de diseño y colores
- **URLs amigables** para cada tienda
- **Configuración de pagos y envíos**

### 📦 Gestión de Productos
- **Productos ilimitados** (según plan)
- **Categorías organizadas**
- **Galería de imágenes**
- **Productos destacados**
- **Estados activo/inactivo**

### 🎨 Personalización Avanzada
- **6 paletas de colores predefinidas**
- **Modo claro/oscuro**
- **Tipografías personalizables**
- **Bordes redondeados ajustables**
- **Responsive design**

### 📱 Integración WhatsApp
- **Generación automática de mensajes**
- **Plantillas personalizables**
- **Carrito de compras integrado**
- **Información de contacto y entrega**

### 📊 Analíticas
- **Seguimiento de visitas**
- **Métricas de pedidos**
- **Valor total de ventas**
- **Filtros por fecha** (planes premium)

### 👥 Planes de Usuario
- **Gratuito**: 1 tienda, 10 productos
- **Emprendedor**: 2 tiendas, 30 productos
- **Profesional**: 5 tiendas, 50 productos

## 🚀 Tecnologías

### Frontend
- **React 18** con TypeScript
- **Tailwind CSS** para estilos
- **Lucide React** para iconos
- **React Router** para navegación
- **Context API** para estado global

### Backend
- **Supabase** como BaaS
- **PostgreSQL** como base de datos
- **Row Level Security (RLS)**
- **Autenticación integrada**

### Herramientas
- **Vite** como bundler
- **ESLint** para linting
- **TypeScript** para tipado estático

## 🏗️ Instalación y Desarrollo

### Prerrequisitos
- Node.js 18+
- npm 8+
- Cuenta de Supabase

### Configuración Local

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd tutaviendo
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales de Supabase:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

4. **Ejecutar en desarrollo**
```bash
npm run dev
```

### Scripts Disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run preview` - Preview del build
- `npm run lint` - Ejecutar ESLint
- `npm run type-check` - Verificar tipos TypeScript

## 🌐 Despliegue en Producción

### Netlify (Recomendado)

1. **Preparar el proyecto**
```bash
npm run build
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

2. **Configurar en Netlify**
- Conectar repositorio en [app.netlify.com](https://app.netlify.com)
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 18

3. **Variables de entorno en Netlify**
```
VITE_SUPABASE_URL = https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY = tu_anon_key_aqui
```

4. **Configurar Supabase**
- Agregar Site URL: `https://tu-sitio.netlify.app`
- Agregar Redirect URLs: `https://tu-sitio.netlify.app/*`

### Otras Plataformas

El proyecto es compatible con:
- **Vercel**
- **Railway**
- **Render**
- **Firebase Hosting**

## 🗄️ Base de Datos

### Esquema Principal

- **users** - Información de usuarios y suscripciones
- **stores** - Configuración de tiendas
- **products** - Productos de cada tienda
- **categories** - Categorías de productos
- **analytics_events** - Eventos de analíticas
- **user_preferences** - Preferencias de usuario

### Tipos Enum

- **user_plan**: `gratuito`, `emprendedor`, `profesional`
- **subscription_status**: `active`, `canceled`, `expired`
- **analytics_event_type**: `visit`, `order`, `product_view`
- **theme_mode**: `light`, `dark`, `system`

## 🔐 Seguridad

- **Row Level Security (RLS)** habilitado
- **Políticas de acceso** granulares
- **Autenticación segura** con Supabase Auth
- **Validación de datos** en frontend y backend

## 📱 Características Móviles

- **Diseño responsive** completo
- **Navegación móvil** optimizada
- **Catálogos móviles** nativos
- **Integración WhatsApp** directa

## 🎯 Roadmap

### Próximas Funcionalidades
- [ ] Integración con pasarelas de pago
- [ ] Exportación de catálogos PDF
- [ ] API pública para integraciones
- [ ] Aplicación móvil nativa
- [ ] Marketplace de plantillas

### Mejoras Técnicas
- [ ] Tests automatizados
- [ ] CI/CD pipeline
- [ ] Optimización de performance
- [ ] PWA capabilities

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 📞 Soporte

- **Email**: soporte@tutaviendo.com
- **Documentación**: [docs.tutaviendo.com](https://docs.tutaviendo.com)
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/tutaviendo/issues)

## 🙏 Agradecimientos

- [Supabase](https://supabase.com) por el backend
- [Tailwind CSS](https://tailwindcss.com) por los estilos
- [Lucide](https://lucide.dev) por los iconos
- [React](https://reactjs.org) por el framework

---

**Hecho con ❤️ para emprendedores que quieren vender más por WhatsApp**

## 🔧 Solución de Problemas

### Build Errors
```bash
# Limpiar cache y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Variables de Entorno
```bash
# Verificar que las variables estén configuradas
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

### Problemas de Autenticación
- Verificar URLs en Supabase Dashboard
- Verificar que las keys sean correctas
- Revisar políticas RLS en Supabase

---

**Estado del Proyecto**: ✅ Listo para Producción