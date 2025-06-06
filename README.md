# 📚 Sistema Integral de Gestión Educativa

Sistema web moderno para la gestión académica completa de instituciones educativas, diseñado para reemplazar las hojas de cálculo tradicionales.

## 🎯 Características Principales

- **Gestión de Estudiantes**: CRUD completo con información académica
- **Módulo de Asistencia**: Registro diario y reportes de ausentismo  
- **Dashboard Administrativo**: Panel de control con estadísticas en tiempo real
- **Módulo Cotidiano**: Seguimiento de actividades diarias
- **Base de Datos Integrada**: SQLite para almacenamiento eficiente
- **Interface Responsive**: Optimizada para desktop y móviles

## 🛠 Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Backend**: Node.js con Express
- **Base de Datos**: SQLite
- **Diseño**: CSS Grid/Flexbox, diseño responsive

## ⚡ Instalación y Uso

```bash
# Clonar el repositorio
git clone https://github.com/luiscraft7/sistema-gestion-educativa.git

# Navegar al directorio
cd sistema-gestion-educativa

# Instalar dependencias
npm install

# Ejecutar el servidor
node server.js
```

El sistema estará disponible en: `http://localhost:3000`

## 📊 Módulos Disponibles

### 🏠 Dashboard
- Resumen estadístico general
- Acceso rápido a todos los módulos
- Gráficos de rendimiento

### 👨‍🎓 Gestión de Estudiantes
- Registro completo de estudiantes
- Edición de información personal y académica
- Búsqueda y filtros avanzados

### 📅 Control de Asistencia
- Registro diario de asistencia
- Reportes de ausentismo por período
- Estadísticas de participación

### 📊 Módulo Cotidiano
- Seguimiento de actividades diarias
- Registro de comportamiento
- Evaluaciones continuas

## 🗄 Estructura del Proyecto

```
sistema-gestion-educativa/
├── data/
│   └── sistema_educativo.db    # Base de datos SQLite
├── database/
│   └── schema.sql              # Esquema de la base de datos
├── public/
│   ├── attendance.html         # Módulo de asistencia
│   ├── dashboard.html          # Dashboard principal
│   ├── index.html              # Página de inicio
│   └── students.html           # Gestión de estudiantes
├── src/
│   ├── models/
│   │   └── database.js         # Conexión y modelos de DB
│   └── routes/
│       ├── package-lock.json
│       ├── package.json
│       └── server.js           # Servidor principal
└── README.md
```

## 🚀 Roadmap de Desarrollo

### ✅ Fase 1 - Completada
- [x] Sistema base con autenticación
- [x] CRUD de estudiantes
- [x] Módulo de asistencia
- [x] Dashboard principal

### 🔄 Fase 2 - En Desarrollo
- [ ] Módulo de tareas y evaluaciones
- [ ] Módulo de exámenes
- [ ] Sistema de calificaciones
- [ ] Reportes avanzados

### 📈 Fase 3 - Planificada
- [ ] Módulo de reportes y análisis
- [ ] Gráficos interactivos
- [ ] Exportación a Excel/PDF
- [ ] Notificaciones automáticas

### 🌐 Fase 4 - Comercialización
- [ ] Multi-tenancy (múltiples escuelas)
- [ ] Planes de suscripción SaaS
- [ ] API REST completa
- [ ] Aplicación móvil

## 💰 Modelo de Negocio

Sistema SaaS con planes de suscripción:
- **Plan Básico**: $29/mes - 1 escuela, hasta 100 estudiantes
- **Plan Profesional**: $79/mes - Hasta 5 escuelas, estudiantes ilimitados  
- **Plan Enterprise**: $199/mes - Escuelas ilimitadas, personalización completa

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para cambios importantes:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📞 Contacto

**Desarrollador**: Luis Alfonso  
**Email**: alfonsoc63@hotmail.com  
**GitHub**: [@luiscraft7](https://github.com/luiscraft7)

---

⭐ **Si este proyecto te resulta útil, no olvides darle una estrella en GitHub!**