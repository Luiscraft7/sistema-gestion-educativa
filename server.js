const express = require('express');
const path = require('path');
const cors = require('cors');
const database = require('./src/models/database');


const app = express();
const PORT = 3000;

// ========================================
// MIDDLEWARES
// ========================================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ========================================

// Middleware para verificar sesión de profesor
async function authenticateTeacher(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const sessionToken = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : req.headers['x-session-token'];

        if (!sessionToken) {
            return res.status(401).json({
                success: false,
                message: 'Token de sesión requerido'
            });
        }

        // Verificar sesión en base de datos
        const query = `
            SELECT s.teacher_id, t.full_name, t.email, t.school_name, t.is_active
            FROM active_sessions s
            INNER JOIN teachers t ON s.teacher_id = t.id
            WHERE s.session_token = ? 
                AND datetime(s.last_activity) > datetime('now', '-24 hours')
                AND t.is_active = 1
        `;

        database.db.get(query, [sessionToken], async (err, session) => {
            if (err || !session) {
                return res.status(401).json({
                    success: false,
                    message: 'Sesión inválida o expirada'
                });
            }

            // Actualizar actividad de la sesión
            await database.updateSessionActivity(sessionToken);

            // Agregar info del profesor al request
            req.teacher = {
                id: session.teacher_id,
                name: session.full_name,
                email: session.email,
                school: session.school_name
            };

            next();
        });

    } catch (error) {
        console.error('Error en autenticación:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
}

// Middleware solo para admin
function requireAdmin(req, res, next) {
    // Verificar si es admin (puedes ajustar esta lógica)
    const adminEmails = ['luiscraft']; // O usar una tabla de admins

    if (req.teacher && adminEmails.includes(req.teacher.email.trim().toLowerCase())) {
        req.isAdmin = true;
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Acceso requiere privilegios de administrador'
        });
    }
}

// Función para generar tokens únicos de sesión
function generateSessionToken() {
    return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Obtener o crear un período académico y devolver su ID
async function getOrCreateAcademicPeriodId(year, period_type, period_number) {
    if (!year || !period_type || !period_number) {
        return null;
    }

    const findQuery = `SELECT id FROM academic_periods WHERE year = ? AND period_type = ? AND period_number = ? LIMIT 1`;
    const existing = await new Promise((resolve, reject) => {
        database.db.get(findQuery, [year, period_type, period_number], (err, row) => {
            if (err) reject(err); else resolve(row);
        });
    });

    if (existing) {
        return existing.id;
    }

    const periodName = `${year} - ${period_number === 1 ? 'Primer' : period_number === 2 ? 'Segundo' : 'Tercer'} ${period_type === 'semester' ? 'Semestre' : 'Trimestre'}`;
    const insertQuery = `INSERT INTO academic_periods (year, period_type, period_number, name, is_active) VALUES (?, ?, ?, ?, 1)`;
    const created = await new Promise((resolve, reject) => {
        database.db.run(insertQuery, [year, period_type, period_number, periodName], function(err) {
            if (err) reject(err); else resolve({ id: this.lastID });
        });
    });

    return created.id;
}

// ========================================
// INICIALIZACIÓN DE BASE DE DATOS
// ========================================
async function initializeDatabase() {
    try {
        console.log('🔄 Inicializando base de datos...');
        
        // ✅ ASEGURAR QUE LA INICIALIZACIÓN SE COMPLETE
        await database.initialize();
        
        // ✅ VERIFICAR QUE LA CONEXIÓN ESTÉ LISTA
        if (!database.db || !database.isInitialized) {
            throw new Error('Base de datos no se inicializó correctamente');
        }
        
        console.log('✅ Base de datos lista para usar');
        console.log('🔍 Estado de la conexión:', {
            hasDb: !!database.db,
            isInitialized: database.isInitialized
        });
        
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
        process.exit(1);
    }
}

// ========================================
// RUTA PRINCIPAL
// ========================================
app.get('/', (req, res) => {
    res.redirect('/welcome.html');
});

// ========================================
// RUTAS API PARA ESTUDIANTES
// ========================================

// ========================================
// REEMPLAZAR ESTE ENDPOINT COMPLETO
// ========================================

/// Obtener todos los estudiantes con filtros opcionales
app.get('/api/students', authenticateTeacher, async (req, res) => {
    try {
        const { year, period_type, period_number } = req.query;
        let academicPeriodId = null;
        const teacherId = req.teacher.id; // ✅ OBTENER DEL TOKEN
        
        console.log('📚 GET /api/students:', { 
            teacher: req.teacher.name, 
            teacherId,
            year, 
            period_type, 
            period_number 
        });
        
        // CORRECCIÓN: Manejo mejorado de períodos académicos
        if (year && period_type && period_number) {
            const periodQuery = `
                SELECT id FROM academic_periods 
                WHERE year = ? AND period_type = ? AND period_number = ?
                LIMIT 1
            `;
            
            const periodRow = await new Promise((resolve, reject) => {
                database.db.get(periodQuery, [year, period_type, period_number], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (periodRow) {
                academicPeriodId = periodRow.id;
                console.log(`📚 Usando período académico ID: ${academicPeriodId}`);
            } else {
                // CORRECCIÓN: Si no existe el período, crearlo automáticamente
                console.log(`🔧 Creando período académico: ${year}-${period_type}-${period_number}`);
                
                const insertPeriodQuery = `
                    INSERT INTO academic_periods (year, period_type, period_number, name, is_active)
                    VALUES (?, ?, ?, ?, 1)
                `;
                
                const periodName = `${year} - ${period_number === 1 ? 'Primer' : period_number === 2 ? 'Segundo' : 'Tercer'} ${period_type === 'semester' ? 'Semestre' : 'Trimestre'}`;
                
                try {
                    const newPeriod = await new Promise((resolve, reject) => {
                        database.db.run(insertPeriodQuery, [year, period_type, period_number, periodName], function(err) {
                            if (err) reject(err);
                            else resolve({ id: this.lastID });
                        });
                    });
                    
                    academicPeriodId = newPeriod.id;
                    console.log(`✅ Período académico creado con ID: ${academicPeriodId}`);
                } catch (createError) {
                    console.error('❌ Error creando período:', createError);
                    return res.json({
                        success: true,
                        data: [],
                        message: '0 estudiantes - error creando período',
                        filter_applied: true
                    });
                }
            }
        }
        
        // ✅ CAMBIO PRINCIPAL: Pasar teacherId a la función
        const students = await database.getAllStudents(academicPeriodId, teacherId);
        
        console.log(`✅ Estudiantes del profesor ${req.teacher.name}: ${students.length}`);
        
        res.json({
            success: true,
            data: students,
            message: `${students.length} estudiantes encontrados`,
            teacher_info: {
                id: req.teacher.id,
                name: req.teacher.name,
                school: req.teacher.school
            },
            filter_applied: !!(year && period_type && period_number),
            period_info: academicPeriodId ? {
                year: parseInt(year),
                period_type: period_type,
                period_number: parseInt(period_number),
                academic_period_id: academicPeriodId
            } : null
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo estudiantes:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estudiantes',
            error: error.message
        });
    }
});

// Copiar estudiantes entre períodos (para uso inicial)
app.post('/api/students/copy-period', async (req, res) => {
    try {
        const { fromPeriodId, toPeriodId } = req.body;
        
        console.log(`📋 Copia solicitada: de período ${fromPeriodId} a período ${toPeriodId}`);
        
        const result = await database.copyStudentsBetweenPeriods(fromPeriodId, toPeriodId);
        
        res.json({
            success: true,
            data: result,
            message: result.message
        });
        
    } catch (error) {
        console.error('❌ Error copiando estudiantes:', error);
        res.status(500).json({
            success: false,
            message: 'Error copiando estudiantes entre períodos',
            error: error.message
        });
    }
});

// Obtener estudiante por ID
app.get('/api/students/:id', async (req, res) => {
    try {
        const student = await database.getStudentById(req.params.id);
        if (student) {
            res.json({
                success: true,
                data: student
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado'
            });
        }
    } catch (error) {
        console.error('Error obteniendo estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estudiante',
            error: error.message
        });
    }
});

// ========================================
// REEMPLAZAR ESTE ENDPOINT COMPLETO
// ========================================

// Agregar nuevo estudiante
app.post('/api/students', authenticateTeacher, async (req, res) => {
    try {
        const teacherId = req.teacher.id; // ✅ OBTENER DEL TOKEN
        
        // Generar ID automático si no viene especificado
        if (!req.body.student_id) {
            req.body.student_id = await database.getNextStudentId();
            console.log('📝 ID generado automáticamente:', req.body.student_id);
        }

        // Asignar período académico actual si no se especifica
        if (!req.body.academic_period_id) {
            // Buscar el período marcado como actual
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (currentPeriod) {
                req.body.academic_period_id = currentPeriod.id;
                console.log('📅 Asignando período académico actual:', currentPeriod.id);
            } else {
                // Fallback al período por defecto
                req.body.academic_period_id = 1;
                console.log('📅 Asignando período académico por defecto: 1');
            }
        }

        console.log('👤 POST /api/students:', {
            teacher: req.teacher.name,
            student: req.body.first_name + ' ' + req.body.first_surname,
            academic_period_id: req.body.academic_period_id,
            grade_level: req.body.grade_level
        });
        
        // ✅ CAMBIO PRINCIPAL: Pasar teacherId a la función
        const result = await database.addStudent(req.body, teacherId);
        
        res.json({
            success: true,
            data: result,
            message: 'Estudiante agregado exitosamente',
            teacher_info: {
                name: req.teacher.name,
                school: req.teacher.school
            }
        });
    } catch (error) {
        console.error('❌ Error agregando estudiante:', error);
        
        if (error.message.includes('UNIQUE constraint failed')) {
            const field = error.message.includes('cedula') ? 'cédula' : 'ID de estudiante';
            res.status(400).json({
                success: false,
                message: `Ya existe un estudiante con esa ${field}`,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error agregando estudiante',
                error: error.message
            });
        }
    }
});

// ========================================
// REEMPLAZAR ESTE ENDPOINT COMPLETO
// ========================================

// Actualizar estudiante
app.put('/api/students/:id', authenticateTeacher, async (req, res) => {
    try {
        const teacherId = req.teacher.id; // ✅ OBTENER DEL TOKEN
        
        console.log('✏️ PUT /api/students:', {
            studentId: req.params.id,
            teacher: req.teacher.name,
            teacherId
        });
        
        // ✅ CAMBIO PRINCIPAL: Pasar teacherId a la función
        const result = await database.updateStudent(req.params.id, req.body, teacherId);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado o no pertenece a este profesor'
            });
        }
        
        res.json({
            success: true,
            data: result,
            message: 'Estudiante actualizado correctamente',
            teacher_info: {
                name: req.teacher.name,
                school: req.teacher.school
            }
        });
    } catch (error) {
        console.error('Error actualizando estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando estudiante',
            error: error.message
        });
    }
});



// Eliminar estudiante
app.delete('/api/students/:id', authenticateTeacher, async (req, res) => {
    try {
        const teacherId = req.teacher.id; // ✅ OBTENER DEL TOKEN
        
        console.log('🗑️ DELETE /api/students:', {
            studentId: req.params.id,
            teacher: req.teacher.name,
            teacherId
        });
        
        // ✅ CAMBIO PRINCIPAL: Pasar teacherId a la función
        const result = await database.deleteStudent(req.params.id, teacherId);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado o no pertenece a este profesor'
            });
        }
        
        res.json({
            success: true,
            data: result,
            message: 'Estudiante eliminado correctamente',
            teacher_info: {
                name: req.teacher.name,
                school: req.teacher.school
            }
        });
    } catch (error) {
        console.error('Error eliminando estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando estudiante',
            error: error.message
        });
    }
});



// ========================================
// API DE LOGIN PARA PROFESORES
// ========================================

// Login de profesores
app.post('/api/teachers/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Buscar profesor por email
        const teacher = await database.getTeacherByEmail(email);
        
        if (!teacher) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales incorrectas'
            });
        }
        
        // Verificar contraseña
        if (teacher.password !== password) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales incorrectas'
            });
        }
        
        // Verificar si está activo
        if (teacher.is_active === 0) {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta está pendiente de aprobación. Contacta al administrador.',
                status: 'pending_approval'
            });
        }
        
        // Login exitoso - REEMPLAZAR esta sección completa
        await database.updateTeacherLastLogin(teacher.id);

        // NUEVO: Limpiar sesiones anteriores del mismo usuario
        try {
            await database.clearUserPreviousSessions(teacher.id);
            console.log(`🧹 Sesiones anteriores limpiadas para: ${teacher.full_name}`);
        } catch (cleanupError) {
            console.error('⚠️ Error limpiando sesiones anteriores:', cleanupError);
        }

        // Crear nueva sesión activa en base de datos
        const sessionToken = generateSessionToken();
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';

        try {
            await database.createActiveSession(teacher.id, sessionToken, ipAddress, userAgent);
            console.log(`✅ Sesión activa creada para profesor: ${teacher.full_name}`);
        } catch (sessionError) {
            console.error('⚠️ Error creando sesión activa:', sessionError);
        }

        // Login del profesor 
        res.json({
            success: true,
            message: 'Login exitoso',
            sessionToken: sessionToken,
            teacher: {
                id: teacher.id,
                name: teacher.full_name,
                email: teacher.email,
                school: teacher.school_name,
                teacher_type: teacher.teacher_type,
                cedula: teacher.cedula,          // ✅ AGREGAR
                regional: teacher.regional       // ✅ AGREGAR
            }
        });
        
    } catch (error) {
        console.error('Error en login de profesor:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// NUEVO ENDPOINT: Actualizar perfil del profesor
app.put('/api/teachers/:id/profile', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, school_name } = req.body;
        
        // Validar campos obligatorios
        if (!name || !school_name) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y escuela son obligatorios'
            });
        }
        
        const result = await database.updateTeacherProfile(id, {
            full_name: name.trim(),
            school_name: school_name.trim()
        });
        
        res.json({
            success: true,
            data: result,
            message: 'Perfil actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando perfil',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA PROFESORES
// ========================================

// Registrar nuevo profesor
app.post('/api/teachers/register', async (req, res) => {
    try {
        const teacherData = req.body;
        
        // Validar campos obligatorios
        const requiredFields = ['full_name', 'cedula', 'school_name', 'email', 'password'];
        for (const field of requiredFields) {
            if (!teacherData[field]) {
                return res.status(400).json({
                    success: false,
                    message: `Campo obligatorio faltante: ${field}`
                });
            }
        }
        
        // Verificar si ya existe
        const existingTeacher = await database.getTeacherByEmail(teacherData.email);
        if (existingTeacher) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un profesor registrado con este email'
            });
        }
        
        const result = await database.createTeacher(teacherData);
        res.json({
            success: true,
            data: result,
            message: 'Profesor registrado exitosamente. Pendiente de activación.'
        });
        
    } catch (error) {
        console.error('Error registrando profesor:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});






// Obtener todos los profesores (para admin)
app.get('/api/teachers', async (req, res) => {
    try {
        const teachers = await database.getAllTeachers();
        res.json({
            success: true,
            data: teachers,
            count: teachers.length
        });
    } catch (error) {
        console.error('Error obteniendo profesores:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo profesores',
            error: error.message
        });
    }
});

// Activar/Desactivar profesor
app.put('/api/teachers/:id/toggle-status', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'activate' or 'deactivate'
        
        const result = await database.toggleTeacherStatus(id, action);
        res.json({
            success: true,
            data: result,
            message: `Profesor ${action === 'activate' ? 'activado' : 'desactivado'} exitosamente`
        });
    } catch (error) {
        console.error('Error cambiando estado del profesor:', error);
        res.status(500).json({
            success: false,
            message: 'Error cambiando estado del profesor',
            error: error.message
        });
    }
});

// Marcar pago
app.put('/api/teachers/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_paid } = req.body;
        
        const result = await database.updateTeacherPayment(id, is_paid);
        res.json({
            success: true,
            data: result,
            message: `Estado de pago actualizado`
        });
    } catch (error) {
        console.error('Error actualizando pago:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando estado de pago',
            error: error.message
        });
    }
});


// NUEVO ENDPOINT: Actualizar perfil del profesor
app.put('/api/teachers/:id/profile', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, school_name } = req.body;
        
        if (!name || !school_name) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y escuela son obligatorios'
            });
        }
        
        const result = await database.updateTeacherProfile(id, {
            full_name: name.trim(),
            school_name: school_name.trim()
        });
        
        res.json({
            success: true,
            data: result,
            message: 'Perfil actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando perfil',
            error: error.message
        });
    }
});



// ========================================
// API PARA ESTADÍSTICAS DEL DASHBOARD
// ========================================

// Obtener estadísticas generales
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const teachers = await database.getAllTeachers();
        const students = await database.getAllStudents();
        
        const stats = {
            professors: {
                total: teachers.length,
                active: teachers.filter(t => t.is_active === 1).length,
                pending: teachers.filter(t => t.is_active === 0).length,
                paid: teachers.filter(t => t.is_paid === 1).length
            },
            students: {
                total: students.length
            },
            schools: {
                total: [...new Set(teachers.map(t => t.school_name))].length
            }
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas',
            error: error.message
        });
    }
});



// ========================================
// RUTAS API PARA GRADOS
// ========================================

// Obtener todos los grados
app.get('/api/grades', authenticateTeacher, async (req, res) => {
    try {
        const grades = await database.getAllGrades(req.teacher.id);
        res.json({
            success: true,
            data: grades
        });
    } catch (error) {
        console.error('Error obteniendo grados:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo grados',
            error: error.message
        });
    }
});

// Agregar nuevo grado
app.post('/api/grades', authenticateTeacher, async (req, res) => {
    try {
        const result = await database.addGrade({ ...req.body, teacher_id: req.teacher.id });
        res.json({
            success: true,
            data: result,
            message: 'Grado agregado correctamente'
        });
    } catch (error) {
        console.error('Error agregando grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error agregando grado',
            error: error.message
        });
    }
});

// Eliminar grado
app.delete('/api/grades/:id', authenticateTeacher, async (req, res) => {
    try {
        const usageCheck = await database.checkGradeUsage(req.params.id, req.teacher.id);
        
        if (usageCheck.inUse) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el grado "${usageCheck.gradeName}" porque está siendo usado por ${usageCheck.studentCount} estudiante(s).`,
                inUse: true,
                studentCount: usageCheck.studentCount
            });
        }

        const result = await database.deleteGrade(req.params.id, req.teacher.id);
        res.json({
            success: true,
            data: result,
            message: 'Grado eliminado correctamente'
        });
    } catch (error) {
        console.error('Error eliminando grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando grado',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA MATERIAS
// ========================================

// Obtener todas las materias (BD)
app.get('/api/subjects', async (req, res) => {
    try {
        const subjects = await database.getAllSubjects();
        res.json({
            success: true,
            data: subjects,
            message: `${subjects.length} materias encontradas`
        });
    } catch (error) {
        console.error('Error obteniendo materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo materias',
            error: error.message
        });
    }
});

// Obtener todas las materias personalizadas (hardcoded)
app.get('/api/custom-subjects', authenticateTeacher, async (req, res) => {
    try {
        const subjects = await database.getAllCustomSubjects(req.teacher.id);
        res.json({
            success: true,
            data: subjects
        });
    } catch (error) {
        console.error('Error obteniendo materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo materias',
            error: error.message
        });
    }
});

// Agregar nueva materia personalizada
app.post('/api/custom-subjects', authenticateTeacher, async (req, res) => {
    try {
        const result = await database.addCustomSubject(req.body, req.teacher.id);
        res.json({
            success: true,
            data: result,
            message: 'Materia agregada correctamente'
        });
    } catch (error) {
        console.error('Error agregando materia:', error);
        res.status(500).json({
            success: false,
            message: 'Error agregando materia',
            error: error.message
        });
    }
});

// Eliminar materia personalizada
app.delete('/api/custom-subjects/:id', authenticateTeacher, async (req, res) => {
    try {
        const usageCheck = await database.checkSubjectUsage(req.params.id, req.teacher.id);
        
        if (usageCheck.inUse) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar la materia "${usageCheck.subjectName}" porque está siendo usada por ${usageCheck.studentCount} estudiante(s).`,
                inUse: true,
                studentCount: usageCheck.studentCount
            });
        }

        const result = await database.deleteCustomSubject(req.params.id, req.teacher.id);
        res.json({
            success: true,
            data: result,
            message: 'Materia eliminada correctamente'
        });
    } catch (error) {
        console.error('Error eliminando materia:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando materia',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA ASISTENCIAS
// ========================================

// Obtener asistencia por fecha y grado
app.get('/api/attendance', authenticateTeacher, async (req, res) => {
    try {
        const { date, grade, subject, year, period_type, period_number } = req.query;

        console.log('📊 GET /api/attendance:', { date, grade, subject });

        if (!date || !grade) {
            return res.status(400).json({
                success: false,
                message: 'Fecha y grado son requeridos'
            });
        }

        let academicPeriodId = req.query.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        const attendance = await database.getAttendanceByDate(date, grade, req.teacher.id, academicPeriodId, subject);
        res.json({
            success: true,
            data: attendance,
            message: `${attendance.length} registros de asistencia encontrados`
        });
    } catch (error) {
        console.error('❌ Error obteniendo asistencia:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo asistencia',
            error: error.message
        });
    }
});

// Marcar o actualizar asistencia
app.post('/api/attendance', authenticateTeacher, async (req, res) => {
    try {
        console.log('📝 POST /api/attendance:', req.body);

        const { year, period_type, period_number } = req.body;

        let academicPeriodId = req.body.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        const result = await database.saveAttendance({
            ...req.body,
            teacher_id: req.teacher.id,
            academic_period_id: academicPeriodId
        });
        res.json({
            success: true,
            data: result,
            message: 'Asistencia guardada correctamente'
        });
    } catch (error) {
        console.error('❌ Error guardando asistencia:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando asistencia',
            error: error.message
        });
    }
});

// Eliminar asistencia de un día específico
app.delete('/api/attendance', authenticateTeacher, async (req, res) => {
    try {
        const { date, grade, subject, year, period_type, period_number } = req.query;

        console.log('🗑️ DELETE /api/attendance:', { date, grade, subject });
        
        if (!date || !grade) {
            return res.status(400).json({
                success: false,
                message: 'Fecha y grado son requeridos'
            });
        }
        
        let academicPeriodId = req.query.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        const result = await database.deleteAttendanceByDate(date, grade, req.teacher.id, academicPeriodId, subject);
        res.json({
            success: true,
            data: result,
            message: 'Asistencia eliminada correctamente'
        });
    } catch (error) {
        console.error('❌ Error eliminando asistencia:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando asistencia',
            error: error.message
        });
    }
});

// Guardar escala máxima de notas
app.put('/api/grade-scale', async (req, res) => {
    try {
        const { grade, subject, maxScale } = req.body;
        
        if (!grade || !subject || maxScale === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Grado, materia y escala máxima son requeridos'
            });
        }
        
        if (maxScale <= 0 || maxScale > 100) {
            return res.status(400).json({
                success: false,
                message: 'La escala debe estar entre 0.1 y 100'
            });
        }
        
        await database.saveGradeScale(grade, subject, maxScale);
        
        res.json({
            success: true,
            message: 'Escala de notas guardada correctamente'
        });
    } catch (error) {
        console.error('Error guardando escala:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando escala',
            error: error.message
        });
    }
});

// Obtener escala máxima actual
app.get('/api/grade-scale', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }
        
        const maxScale = await database.getGradeScale(grade, subject);
        
        res.json({
            success: true,
            max_scale: maxScale
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});




// ========================================
// ESTADÍSTICAS MEP - ENDPOINTS CORREGIDOS ✅
// ========================================

// Obtener estadísticas de asistencia de un estudiante (MEJORADO)
app.get('/api/attendance/stats/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { grade, subject, totalLessons, year, period_type, period_number, academic_period_id } = req.query;
        
        console.log('📊 Calculando estadísticas MEP para:', { studentId, grade, subject, totalLessons, year, period_type, period_number, academic_period_id });
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro grade es requerido'
            });
        }
        
        // ✅ VERIFICAR ESTADO DE LA BASE DE DATOS
        if (!database.db || !database.isInitialized) {
            console.error('❌ Base de datos no está inicializada');
            return res.status(500).json({
                success: false,
                message: 'Base de datos no está disponible',
                debug: {
                    hasDb: !!database.db,
                    isInitialized: database.isInitialized
                }
            });
        }
        
        // ✅ LLAMAR A LA FUNCIÓN CON MANEJO DE ERRORES MEJORADO
        console.log('🔄 Llamando a calculateMEPAttendanceGrade...');
        
        let academicPeriodId = academic_period_id || null;
        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }
        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        const mepGrade = await database.calculateMEPAttendanceGrade(
            parseInt(studentId),
            grade,
            subject || 'general',
            parseInt(totalLessons) || 200,
            academicPeriodId
        );
        
        console.log('✅ Estadísticas MEP calculadas exitosamente');
        
        res.json({
            success: true,
            data: mepGrade
        });
        
    } catch (error) {
        console.error('❌ Error completo en estadísticas MEP:', {
            message: error.message,
            stack: error.stack,
            studentId: req.params.studentId,
            query: req.query
        });
        
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas de asistencia',
            error: error.message
        });
    }
});

// Obtener estadísticas de toda la clase
app.get('/api/attendance/class-stats', async (req, res) => {
    try {
        const { grade, subject, totalLessons, year, period_type, period_number, academic_period_id } = req.query;
        
        console.log('📊 Calculando estadísticas de clase para:', { grade, subject, totalLessons, year, period_type, period_number, academic_period_id });
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro grade es requerido'
            });
        }
        
        let academicPeriodId = academic_period_id || null;
        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }
        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        // Obtener estudiantes del grado
        const students = await database.getAllStudents(academicPeriodId);
        const gradeStudents = students.filter(s => 
            s.grade_level === grade && 
            s.status === 'active' &&
            (!subject || s.subject_area === subject)
        );
        
        console.log(`👥 Estudiantes encontrados: ${gradeStudents.length}`);
        
        // Calcular estadísticas para cada estudiante
        const classStats = await Promise.all(
            gradeStudents.map(async (student) => {
                const mepGrade = await database.calculateMEPAttendanceGrade(
                    student.id,
                    grade,
                    subject || 'general',
                    parseInt(totalLessons) || 200,
                    academicPeriodId
                );
                return {
                    ...student,
                    mep_stats: mepGrade
                };
            })
        );
        
        const summary = {
            total_students: classStats.length,
            average_attendance: classStats.reduce((sum, s) => sum + s.mep_stats.attendance_percentage, 0) / classStats.length,
            average_grade: classStats.reduce((sum, s) => sum + s.mep_stats.nota_asistencia, 0) / classStats.length,
            max_scale: classStats.length > 0 ? classStats[0].mep_stats.max_scale || 5.0 : 5.0  // ✅ AGREGAR ESTA LÍNEA
        };
        
        console.log('✅ Estadísticas de clase calculadas:', summary);
        
        res.json({
            success: true,
            data: classStats,
            summary: summary
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de clase:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas de clase',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA CONFIGURACIÓN DE LECCIONES
// ========================================

// Obtener configuración de lecciones
app.get('/api/lesson-config', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Grado es requerido'
            });
        }
        
        const config = await database.getLessonConfig(grade, subject || 'general');
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('❌ Error obteniendo configuración de lecciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo configuración',
            error: error.message
        });
    }
});

// Guardar configuración de lecciones
app.post('/api/lesson-config', async (req, res) => {
    try {
        console.log('⚙️ POST /api/lesson-config:', req.body);
        
        const result = await database.saveLessonConfig(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Configuración guardada correctamente'
        });
    } catch (error) {
        console.error('❌ Error guardando configuración de lecciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando configuración',
            error: error.message
        });
    }
});

// Contar lecciones reales dadas
app.get('/api/attendance/lesson-count', async (req, res) => {
    try {
        const { grade } = req.query;
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Grado es requerido'
            });
        }
        
        database.ensureConnection();
        
        const query = `
            SELECT COUNT(DISTINCT date) as total_lessons
            FROM attendance 
            WHERE grade_level = ? 
            AND status IN ('present', 'late_justified', 'late_unjustified', 'absent_justified', 'absent_unjustified')
        `;
        
        const result = await new Promise((resolve, reject) => {
            database.db.get(query, [grade], (err, row) => {
                if (err) reject(err);
                else resolve(row || { total_lessons: 0 });
            });
        });
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error contando lecciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error contando lecciones',
            error: error.message
        });
    }
});


// ========================================
// RUTAS API PARA ASIGNACIÓN GRADOS-MATERIAS
// ========================================

// Asignar múltiples materias a un grado
app.post('/api/grade-subjects/assign', authenticateTeacher, async (req, res) => {
    try {
        console.log('📚 POST /api/grade-subjects/assign:', req.body);
        
        const { gradeName, subjects, teacherName, year, period_type, period_number } = req.body;

        let academicPeriodId = req.body.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }
        
        if (!gradeName || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materias son requeridos'
            });
        }
        
        const result = await database.assignSubjectsToGrade({ ...req.body, teacherId: req.teacher.id, teacherName: teacherName || req.teacher.name, academicPeriodId });
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error asignando materias a grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error asignando materias',
            error: error.message
        });
    }
});

// Asignar materias a múltiples grados
app.post('/api/grade-subjects/assign-multiple', authenticateTeacher, async (req, res) => {
    try {
        console.log('📚 POST /api/grade-subjects/assign-multiple:', req.body);

        const { grades, subjects, teacherName, year, period_type, period_number } = req.body;

        let academicPeriodId = req.body.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }
        
        if (!grades || !Array.isArray(grades) || grades.length === 0 ||
            !subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Grados y materias son requeridos'
            });
        }
        
        const result = await database.assignSubjectsToMultipleGrades({ ...req.body, teacherId: req.teacher.id, teacherName: teacherName || req.teacher.name, academicPeriodId });
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error asignando materias a múltiples grados:', error);
        res.status(500).json({
            success: false,
            message: 'Error asignando materias',
            error: error.message
        });
    }
});

// Obtener materias de un grado
app.get('/api/grade-subjects/:gradeName', authenticateTeacher, async (req, res) => {
    try {
        const { gradeName } = req.params;
        const { year, period_type, period_number } = req.query;

        let academicPeriodId = req.query.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        console.log('📖 GET /api/grade-subjects/' + gradeName);
        const subjects = await database.getSubjectsByGrade(gradeName, req.teacher.id, academicPeriodId);
        res.json({
            success: true,
            data: subjects,
            gradeName: gradeName,
            message: `${subjects.length} materias encontradas para ${gradeName}`
        });
    } catch (error) {
        console.error('❌ Error obteniendo materias del grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo materias',
            error: error.message
        });
    }
});

// Obtener todos los grados con sus materias
app.get('/api/grade-subjects', authenticateTeacher, async (req, res) => {
    try {
        console.log('📚 GET /api/grade-subjects');

        const { year, period_type, period_number } = req.query;

        let academicPeriodId = req.query.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        const gradesWithSubjects = await database.getAllGradesWithSubjects(req.teacher.id, academicPeriodId);
        res.json({
            success: true,
            data: gradesWithSubjects,
            message: `${gradesWithSubjects.length} grados con materias obtenidos`
        });
    } catch (error) {
        console.error('❌ Error obteniendo grados con materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos',
            error: error.message
        });
    }
});

// Eliminar materia de un grado
app.delete('/api/grade-subjects/:gradeName/:subjectName', authenticateTeacher, async (req, res) => {
    try {
        const { gradeName, subjectName } = req.params;
        const { year, period_type, period_number } = req.query;

        let academicPeriodId = req.query.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        console.log(`🗑️ DELETE /api/grade-subjects/${gradeName}/${subjectName}`);

        const result = await database.removeSubjectFromGrade(gradeName, subjectName, req.teacher.id, academicPeriodId);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error eliminando materia del grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando asignación',
            error: error.message
        });
    }
});

// ========================================
// RUTAS PARA ELIMINACIÓN MASIVA
// ========================================

// Eliminar múltiples grados
app.delete('/api/grades/bulk', authenticateTeacher, async (req, res) => {
    try {
        const { gradeIds } = req.body;
        
        console.log('🗑️ DELETE /api/grades/bulk:', gradeIds);
        
        if (!gradeIds || !Array.isArray(gradeIds) || gradeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Array de IDs de grados es requerido'
            });
        }
        
        // Verificar uso de cada grado antes de eliminar
        const usageChecks = await Promise.all(
            gradeIds.map(id => database.checkGradeUsage(id, req.teacher.id))
        );
        
        const inUseGrades = usageChecks.filter(check => check.inUse);
        
        if (inUseGrades.length > 0) {
            const inUseNames = inUseGrades.map(g => `"${g.gradeName}" (${g.studentCount} estudiantes)`);
            return res.status(400).json({
                success: false,
                message: `No se pueden eliminar los siguientes grados porque están siendo usados:\n${inUseNames.join('\n')}`,
                inUseGrades: inUseGrades
            });
        }
        
        const result = await database.deleteMultipleGrades(gradeIds, req.teacher.id);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error eliminando grados:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando grados',
            error: error.message
        });
    }
});

// Eliminar múltiples materias
app.delete('/api/custom-subjects/bulk', authenticateTeacher, async (req, res) => {
    try {
        const { subjectIds } = req.body;
        
        console.log('🗑️ DELETE /api/custom-subjects/bulk:', subjectIds);
        
        if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Array de IDs de materias es requerido'
            });
        }
        
        // Verificar uso de cada materia antes de eliminar
        const usageChecks = await Promise.all(
            subjectIds.map(id => database.checkSubjectUsage(id, req.teacher.id))
        );
        
        const inUseSubjects = usageChecks.filter(check => check.inUse);
        
        if (inUseSubjects.length > 0) {
            const inUseNames = inUseSubjects.map(s => `"${s.subjectName}" (${s.studentCount} estudiantes)`);
            return res.status(400).json({
                success: false,
                message: `No se pueden eliminar las siguientes materias porque están siendo usadas:\n${inUseNames.join('\n')}`,
                inUseSubjects: inUseSubjects
            });
        }
        
        const result = await database.deleteMultipleSubjects(subjectIds, req.teacher.id);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error eliminando materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando materias',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA EVALUACIONES - CORREGIDAS ✅
// ========================================

// Obtener evaluaciones por grado y materia filtradas por período académico
app.get('/api/evaluations', authenticateTeacher, async (req, res) => {
    try {
        const { grade, subject, year, period_type, period_number } = req.query;

        if (!grade || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }

        let academicPeriodId = null;
        if (year && period_type && period_number) {
            const periodQuery = `
                SELECT id FROM academic_periods
                WHERE year = ? AND period_type = ? AND period_number = ?
                LIMIT 1
            `;

            const periodRow = await new Promise((resolve, reject) => {
                database.db.get(periodQuery, [year, period_type, period_number], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            if (periodRow) {
                academicPeriodId = periodRow.id;
            } else {
                const insertQuery = `
                    INSERT INTO academic_periods (year, period_type, period_number, name, is_active)
                    VALUES (?, ?, ?, ?, 1)
                `;
                const periodName = `${year} - ${period_number === '1' ? 'Primer' : period_number === '2' ? 'Segundo' : 'Tercer'} ${period_type === 'semester' ? 'Semestre' : 'Trimestre'}`;
                const newPeriod = await new Promise((resolve, reject) => {
                    database.db.run(insertQuery, [year, period_type, period_number, periodName], function(err) {
                        if (err) reject(err); else resolve({ id: this.lastID });
                    });
                });
                academicPeriodId = newPeriod.id;
            }
        }

        console.log('📝 GET /api/evaluations:', { grade, subject, academicPeriodId, teacher: req.teacher.id });

        const evaluations = await database.getEvaluationsByGradeSubjectAndPeriod(
            grade,
            subject,
            academicPeriodId,
            req.teacher.id
        );
        res.json({
            success: true,
            data: evaluations,
            message: `${evaluations.length} evaluaciones encontradas`
        });
    } catch (error) {
        console.error('❌ Error obteniendo evaluaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo evaluaciones',
            error: error.message
        });
    }
});

// Crear nueva evaluación
app.post('/api/evaluations', authenticateTeacher, async (req, res) => {
    try {
        console.log('📝 POST /api/evaluations:', req.body);

        const { year, period_type, period_number } = req.body;

        let academicPeriodId = req.body.academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        const result = await database.createEvaluation({
            ...req.body,
            teacher_id: req.teacher.id,
            teacher_name: req.body.teacher_name || req.teacher.name,
            academic_period_id: academicPeriodId
        });
        res.json({
            success: true,
            data: result,
            message: 'Evaluación creada correctamente'
        });
    } catch (error) {
        console.error('❌ Error creando evaluación:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando evaluación',
            error: error.message
        });
    }
});

// Actualizar evaluación
app.put('/api/evaluations/:id', authenticateTeacher, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📝 PUT /api/evaluations/${id}:`, req.body);
        
        const result = await database.updateEvaluation(id, req.body);
        res.json({
            success: true,
            data: result,
            message: 'Evaluación actualizada correctamente'
        });
    } catch (error) {
        console.error('❌ Error actualizando evaluación:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando evaluación',
            error: error.message
        });
    }
});

// Eliminar evaluación
app.delete('/api/evaluations/:id', authenticateTeacher, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ DELETE /api/evaluations/${id}`);
        
        const result = await database.deleteEvaluation(id);
        res.json({
            success: true,
            data: result,
            message: 'Evaluación eliminada correctamente'
        });
    } catch (error) {
        console.error('❌ Error eliminando evaluación:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando evaluación',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA CALIFICACIONES DE EVALUACIONES - CORREGIDAS ✅
// ========================================

// Obtener calificaciones de una evaluación
app.get('/api/evaluation-grades/:evaluationId', authenticateTeacher, async (req, res) => {
    try {
        const { evaluationId } = req.params;
        console.log('📊 GET /api/evaluation-grades/' + evaluationId);

        const grades = await database.getEvaluationGrades(evaluationId, req.teacher.id);
        res.json({
            success: true,
            data: grades,
            message: `${grades.length} estudiantes encontrados`
        });
    } catch (error) {
        console.error('❌ Error obteniendo calificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo calificaciones',
            error: error.message
        });
    }
});

// Guardar calificaciones de evaluación
app.post('/api/evaluation-grades', async (req, res) => {
    try {
        const { grades } = req.body;
        
        if (!grades || !Array.isArray(grades)) {
            return res.status(400).json({
                success: false,
                message: 'Array de calificaciones es requerido'
            });
        }
        
        console.log('💾 POST /api/evaluation-grades:', grades.length, 'calificaciones');
        
        const result = await database.saveEvaluationGrades(grades);
        res.json({
            success: true,
            data: result,
            message: `${result.savedCount} calificaciones guardadas correctamente`
        });
    } catch (error) {
        console.error('❌ Error guardando calificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando calificaciones',
            error: error.message
        });
    }
});

// ========================================
// RUTAS PARA DASHBOARD DE EVALUACIONES - CORREGIDAS ✅
// ========================================

// Resumen general de evaluaciones
app.get('/api/evaluations/summary', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/summary');
        
        const summary = await database.getEvaluationsSummary();
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('❌ Error obteniendo resumen:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo resumen',
            error: error.message
        });
    }
});

// Estadísticas por tipo de evaluación
app.get('/api/evaluations/stats/types', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/stats/types');
        
        const stats = await database.getEvaluationTypeStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas por tipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas por tipo',
            error: error.message
        });
    }
});

// Estadísticas por grado
app.get('/api/evaluations/stats/grades', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/stats/grades');
        
        const stats = await database.getEvaluationGradeStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas por grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas por grado',
            error: error.message
        });
    }
});

// Progreso de evaluaciones
app.get('/api/evaluations/progress', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/progress');
        
        const progress = await database.getEvaluationProgress();
        res.json({
            success: true,
            data: progress
        });
    } catch (error) {
        console.error('❌ Error obteniendo progreso:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo progreso',
            error: error.message
        });
    }
});

// ========================================
// ENDPOINTS DE DEBUG Y DIAGNÓSTICO
// ========================================

// Debug: Verificar conexión a base de datos
app.get('/api/debug/connection', async (req, res) => {
    try {
        const connectionStatus = {
            hasDatabase: !!database.db,
            isInitialized: database.isInitialized,
            canExecuteQuery: false
        };
        
        // Test simple de conexión
        if (database.db && database.isInitialized) {
            try {
                await new Promise((resolve, reject) => {
                    database.db.get('SELECT 1 as test', [], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                connectionStatus.canExecuteQuery = true;
            } catch (error) {
                console.error('❌ Error en test de conexión:', error);
            }
        }
        
        res.json({
            success: true,
            connection: connectionStatus,
            message: connectionStatus.canExecuteQuery ? 'Conexión OK' : 'Conexión con problemas'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug: Verificar módulo database
app.get('/api/debug/database', (req, res) => {
    try {
        const debug = {
            databaseType: typeof database,
            hasCalculateFunction: typeof database.calculateMEPAttendanceGrade === 'function',
            availableMethods: Object.getOwnPropertyNames(database),
            prototypeMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(database)),
            hasDbConnection: !!database.db,
            isInitialized: database.isInitialized
        };
        
        console.log('🐛 Debug database info:', debug);
        
        res.json({
            success: true,
            debug: debug
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug: Información de asistencia
app.get('/api/debug/attendance/:date/:grade', async (req, res) => {
    try {
        const { date, grade } = req.params;
        
        console.log('🐛 DEBUG: Verificando asistencia para:', { date, grade });
        
        // Obtener estudiantes del grado
        const students = await database.getAllStudents();
        const gradeStudents = students.filter(s => s.grade_level === grade && s.status === 'active');
        
        // Obtener asistencia
        const attendance = await database.getAttendanceByDate(date, grade);
        
        // Mostrar debug info
        const debugInfo = {
            date: date,
            grade: grade,
            studentsInGrade: gradeStudents.length,
            attendanceRecords: attendance.length,
            students: gradeStudents.map(s => ({
                id: s.id,
                name: `${s.first_name} ${s.first_surname}`,
                student_id: s.student_id
            })),
            attendance: attendance.map(a => ({
                student_id: a.student_id,
                status: a.status,
                student_name: `${a.first_name} ${a.first_surname}`
            }))
        };
        
        console.log('🐛 DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
        
        res.json({
            success: true,
            debug: debugInfo
        });
    } catch (error) {
        console.error('❌ Error en debug:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug: Registros de asistencia de estudiante específico
app.get('/api/debug/student-attendance/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { grade, subject } = req.query;
        
        if (!database.db) {
            return res.status(500).json({ 
                success: false, 
                error: 'Base de datos no disponible' 
            });
        }
        
        const query = `
            SELECT * FROM attendance 
            WHERE student_id = ? AND grade_level = ? AND subject_area = ?
            ORDER BY date DESC
        `;
        
        database.db.all(query, [parseInt(studentId), grade, subject || 'general'], (err, rows) => {
            if (err) {
                res.status(500).json({ success: false, error: err.message });
            } else {
                res.json({
                    success: true,
                    student_id: studentId,
                    grade: grade,
                    subject: subject || 'general',
                    total_records: rows.length,
                    records: rows
                });
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug: Verificar materia específica
app.get('/api/debug/subjects/:id', async (req, res) => {
    try {
        const subjectId = req.params.id;
        
        // Verificar si la materia existe
        const checkQuery = 'SELECT * FROM custom_subjects WHERE id = ?';
        
        database.db.get(checkQuery, [subjectId], async (err, subject) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            
            if (!subject) {
                return res.json({ 
                    success: true, 
                    exists: false, 
                    message: 'Materia no encontrada' 
                });
            }
            
            // Verificar uso de la materia
            const usageQuery = 'SELECT COUNT(*) as count FROM students WHERE subject_area = ? AND status = "active"';
            
            database.db.get(usageQuery, [subject.name], (err, usageResult) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                
                res.json({
                    success: true,
                    exists: true,
                    subject: subject,
                    usage: usageResult.count,
                    canDelete: usageResult.count === 0
                });
            });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug: Ver qué devuelve getEvaluationGrades
app.get('/api/debug/evaluation-grades/:evaluationId', authenticateTeacher, async (req, res) => {
    try {
        const { evaluationId } = req.params;
        
        console.log('🐛 DEBUG: Obteniendo evaluation grades para evaluación', evaluationId);
        
        const grades = await database.getEvaluationGrades(evaluationId, req.teacher.id);
        
        res.json({
            success: true,
            debug: {
                evaluation_id: evaluationId,
                total_students: grades.length,
                students: grades.map(g => ({
                    student_id: g.student_id,
                    name: `${g.first_surname} ${g.first_name}`,
                    has_grade: !!g.grade_id,
                    points: g.points_earned || 'Sin calificar'
                }))
            },
            data: grades
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// INICIAR SERVIDOR
// ========================================
async function startServer() {
    try {
        // Primero inicializar la base de datos
        await initializeDatabase();
        
        // Después iniciar el servidor
        app.listen(PORT, () => {
            console.log('🚀 Servidor corriendo en http://localhost:' + PORT);
            console.log('📊 API disponible en /api/students, /api/subjects, /api/attendance');
            console.log('📝 Evaluaciones disponibles en /api/evaluations, /api/evaluation-grades');
            console.log('🐛 Debug endpoints: /api/debug/connection, /api/debug/database');
        });
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
    }
}

// ========================================
// APIs DEL MÓDULO DE COTIDIANO (VERSIÓN FINAL)
// ========================================

// Obtener indicadores por grado y materia
app.get('/api/cotidiano/indicators', authenticateTeacher, async (req, res) => {
    try {
        const { grade, subject, academic_period_id } = req.query;
        const teacher_id = req.query.teacher_id || req.teacher.id;
        
        if (!grade || !subject) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grade and subject are required' 
            });
        }
        
        const indicators = await database.getIndicatorsByGradeAndSubject(
            grade,
            subject,
            academic_period_id ? parseInt(academic_period_id) : 1,
            teacher_id ? parseInt(teacher_id) : undefined
        );
        
        res.json({
            success: true,
            data: indicators,
            message: `${indicators.length} indicadores encontrados`
        });
        
    } catch (error) {
        console.error('Error in cotidiano indicators API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo indicadores',
            error: error.message 
        });
    }
});

// Crear nuevo indicador
app.post('/api/cotidiano/indicators', authenticateTeacher, async (req, res) => {
    try {
        const { academic_period_id, grade_level, subject_area, indicator_name, parent_indicator_id } = req.body;
        const teacher_id = req.body.teacher_id || req.teacher.id;
        
        if (!grade_level || !subject_area || !indicator_name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: grade_level, subject_area, indicator_name' 
            });
        }
        
        const result = await database.createIndicator({
            academic_period_id: academic_period_id ? parseInt(academic_period_id) : 1,
            teacher_id,
            grade_level,
            subject_area,
            indicator_name,
            parent_indicator_id
        });
        
        res.json({ 
            success: true,
            data: result, 
            message: 'Indicador creado exitosamente' 
        });
        
    } catch (error) {
        console.error('Error in create indicator API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando indicador',
            error: error.message 
        });
    }
});

// Crear múltiples indicadores de una vez
app.post('/api/cotidiano/indicators/bulk', authenticateTeacher, async (req, res) => {
    try {
        const { academic_period_id, grade_level, subject_area, indicators } = req.body;
        const teacher_id = req.body.teacher_id || req.teacher.id;
        const result = await database.createBulkIndicators({
            academic_period_id: academic_period_id ? parseInt(academic_period_id) : 1,
            teacher_id,
            grade_level,
            subject_area,
            indicators
        });
        
        res.json({ 
            success: result.summary.success > 0,
            data: result,
            message: `${result.summary.success} indicadores creados, ${result.summary.errors} errores` 
        });
        
    } catch (error) {
        console.error('Error in bulk create indicators API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando indicadores múltiples',
            error: error.message 
        });
    }
});

// Eliminar indicador
app.delete('/api/cotidiano/indicators/:id', authenticateTeacher, async (req, res) => {
    try {
        const { id } = req.params;
        
        database.ensureConnection();
        
        const query = 'DELETE FROM daily_indicators WHERE id = ?';
        
        database.db.run(query, [id], function(err) {
            if (err) {
                console.error('Error deleting indicator:', err);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error eliminando indicador',
                    error: err.message 
                });
            } else {
                res.json({ 
                    success: true,
                    data: { deleted: this.changes },
                    message: 'Indicador eliminado exitosamente' 
                });
            }
        });
        
    } catch (error) {
        console.error('Error in delete indicator API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error eliminando indicador',
            error: error.message 
        });
    }
});

// Cargar evaluación existente - CORREGIDO COMPLETO FINAL
// Cargar evaluación existente - CORREGIDO PARA FECHAS LIMPIAS
app.get('/api/cotidiano/evaluation', authenticateTeacher, async (req, res) => {
    try {
        const { academic_period_id, grade_level, subject_area, evaluation_date } = req.query;
        const teacher_id = req.query.teacher_id || req.teacher.id;
        
        if (!grade_level || !subject_area || !evaluation_date) {
            return res.status(400).json({
                success: false,
                message: 'Grado, materia y fecha son requeridos'
            });
        }
        
        console.log('📖 Cargando evaluación cotidiano:', { academic_period_id, teacher_id, grade_level, subject_area, evaluation_date });
        
        database.ensureConnection();
        
        // 1. Verificar si existen evaluaciones para esta fecha específica
        const hasEvaluationsQuery = `
            SELECT COUNT(*) as count FROM daily_evaluations
            WHERE grade_level = ? AND subject_area = ? AND evaluation_date = ? AND academic_period_id = ? AND teacher_id = ?
        `;

        const hasEvaluations = await new Promise((resolve, reject) => {
            database.db.get(hasEvaluationsQuery, [grade_level, subject_area, evaluation_date, academic_period_id ? parseInt(academic_period_id) : 1, teacher_id], (err, row) => {
                if (err) reject(err);
                else resolve(row.count > 0);
            });
        });
        
        console.log(`📊 ¿Hay evaluaciones para fecha ${evaluation_date}? ${hasEvaluations}`);
        
        let indicators = [];
        let studentsData = {};
        
        if (hasEvaluations) {
            // CASO A: SI hay evaluaciones para esta fecha específica
            console.log('📋 ✅ FECHA CON EVALUACIONES: Cargando indicadores y calificaciones existentes');
            
            // PASO 1: Obtener indicadores con scores
            const indicatorsWithScoresQuery = `
                SELECT DISTINCT di.*
                FROM daily_indicators di
                INNER JOIN daily_indicator_scores dis ON di.id = dis.daily_indicator_id
                INNER JOIN daily_evaluations de ON dis.daily_evaluation_id = de.id
                WHERE de.grade_level = ? AND de.subject_area = ? AND de.evaluation_date = ? AND de.academic_period_id = ? AND de.teacher_id = ?
            `;

            const indicatorsWithScores = await new Promise((resolve, reject) => {
                database.db.all(indicatorsWithScoresQuery, [grade_level, subject_area, evaluation_date, academic_period_id ? parseInt(academic_period_id) : 1, teacher_id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
            
            console.log(`📋 Indicadores con scores encontrados: ${indicatorsWithScores.length}`);
            
            // PASO 2: Obtener los IDs de los padres de estos indicadores
            const parentIds = [...new Set(
                indicatorsWithScores
                    .filter(ind => ind.parent_indicator_id)
                    .map(ind => ind.parent_indicator_id)
            )];
            
            console.log(`🎯 IDs de padres detectados: [${parentIds.join(', ')}]`);
            
            // PASO 3: Obtener los indicadores principales (padres)
            let parentIndicators = [];
            if (parentIds.length > 0) {
                const placeholders = parentIds.map(() => '?').join(',');
                const parentsQuery = `
                    SELECT * FROM daily_indicators
                    WHERE id IN (${placeholders}) AND grade_level = ? AND subject_area = ? AND academic_period_id = ? AND teacher_id = ?
                `;

                parentIndicators = await new Promise((resolve, reject) => {
                    database.db.all(parentsQuery, [...parentIds, grade_level, subject_area, academic_period_id ? parseInt(academic_period_id) : 1, teacher_id], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    });
                });
                
                console.log(`🎯 Indicadores principales encontrados: ${parentIndicators.length}`);
            }
            
            // PASO 4: Combinar indicadores principales + sub-indicadores
            indicators = [...parentIndicators, ...indicatorsWithScores];
            indicators.sort((a, b) => {
                if (!a.parent_indicator_id && b.parent_indicator_id) return -1;
                if (a.parent_indicator_id && !b.parent_indicator_id) return 1;
                return a.id - b.id;
            });
            
            console.log(`📋 Total indicadores cargados: ${indicators.length}`);
            
            // PASO 5: Cargar calificaciones de estudiantes para esta fecha
            const evaluationsQuery = `
                SELECT
                    de.id as evaluation_id,
                    de.student_id,
                    s.first_surname,
                    s.second_surname,
                    s.first_name,
                    dis.daily_indicator_id AS indicator_id,
                    dis.score,
                    dis.notes
                FROM daily_evaluations de
                LEFT JOIN students s ON de.student_id = s.id
                LEFT JOIN daily_indicator_scores dis ON de.id = dis.daily_evaluation_id
                WHERE de.grade_level = ? AND de.subject_area = ? AND de.evaluation_date = ? AND de.academic_period_id = ? AND de.teacher_id = ?
                ORDER BY s.first_surname, s.first_name, dis.daily_indicator_id
            `;

            const evaluations = await new Promise((resolve, reject) => {
                database.db.all(evaluationsQuery, [grade_level, subject_area, evaluation_date, academic_period_id ? parseInt(academic_period_id) : 1, teacher_id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
            
            console.log(`👥 Evaluaciones encontradas: ${evaluations.length} registros`);
            
            // Organizar datos por estudiante
            evaluations.forEach(row => {
                if (row.student_id && row.first_surname) {
                    const studentName = `${row.first_surname} ${row.second_surname || ''} ${row.first_name}`.trim();
                    
                    if (!studentsData[studentName]) {
                        studentsData[studentName] = {};
                    }
                    
                    if (row.indicator_id && row.score !== null) {
                        studentsData[studentName][row.indicator_id] = row.score;
                    }
                }
            });
            
        } else {
            // CASO B: NO hay evaluaciones para esta fecha específica
            console.log('📋 ❌ FECHA SIN EVALUACIONES: Interfaz limpia para nuevos indicadores');
            console.log('✨ El usuario puede crear indicadores específicos para esta fecha');
            
            // ✅ COMPORTAMIENTO NUEVO: NO cargar indicadores de otras fechas
            // ✅ Dejar indicators = [] para que la interfaz esté limpia
            // ✅ Permitir al usuario crear indicadores específicos para esta fecha
            
            indicators = [];
            studentsData = {};
            
            console.log('🆕 Fecha limpia - el usuario puede agregar nuevos indicadores');
        }
        
        console.log(`📊 Estudiantes con calificaciones: ${Object.keys(studentsData).length}`);
        if (Object.keys(studentsData).length > 0) {
            console.log('👥 Estudiantes encontrados:', Object.keys(studentsData));
        }
        
        // DEBUG: Mostrar estructura final de indicadores
        if (indicators.length > 0) {
            console.log('🔍 ESTRUCTURA FINAL DE INDICADORES:');
            indicators.forEach((ind, index) => {
                console.log(`  ${index + 1}. ID: ${ind.id}, Nombre: "${ind.indicator_name}", Padre: ${ind.parent_indicator_id || 'NULL'}`);
            });
        } else {
            console.log('📝 Sin indicadores - interfaz limpia para esta fecha');
        }
        
        res.json({
            success: true,
            data: {
                indicators: indicators,
                students: studentsData
            },
            message: hasEvaluations 
                ? `Evaluación cargada: ${indicators.length} indicadores, ${Object.keys(studentsData).length} estudiantes`
                : `Fecha limpia: lista para nuevos indicadores`,
            strategy_used: hasEvaluations ? 'evaluaciones_existentes' : 'fecha_limpia',
            has_evaluations: hasEvaluations,
            is_clean_date: !hasEvaluations
        });
        
    } catch (error) {
        console.error('❌ Error cargando evaluación cotidiano:', error);
        res.status(500).json({
            success: false,
            message: 'Error cargando evaluación',
            error: error.message
        });
    }
});

// Guardar evaluación del cotidiano
app.post('/api/cotidiano/evaluation', authenticateTeacher, async (req, res) => {
    try {
        const { academic_period_id, grade_level, subject_area, evaluation_date, main_indicator, indicators, students } = req.body;
        const teacher_id = req.body.teacher_id || req.teacher.id;
        
        if (!grade_level || !subject_area || !evaluation_date) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grado, materia y fecha son requeridos' 
            });
        }
        
        console.log('💾 Guardando evaluación cotidiano:', {
            academic_period_id,
            teacher_id,
            grade_level,
            subject_area,
            evaluation_date,
            indicators: indicators?.length || 0,
            students: Object.keys(students || {}).length
        });
        
        database.ensureConnection();
        
        // 1. Guardar/actualizar indicadores
        const indicatorPromises = [];
        
        if (main_indicator) {
            const mainPromise = new Promise((resolve, reject) => {
                const mainQuery = `
                    INSERT OR REPLACE INTO daily_indicators
                    (id, academic_period_id, teacher_id, grade_level, subject_area, indicator_name, parent_indicator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NULL, datetime('now'))
                `;
                database.db.run(
                    mainQuery,
                    [
                        main_indicator.id,
                        academic_period_id ? parseInt(academic_period_id) : 1,
                        teacher_id,
                        grade_level,
                        subject_area,
                        main_indicator.text
                    ],
                    function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
            indicatorPromises.push(mainPromise);
        }
        
        if (indicators && indicators.length > 0) {
            indicators.forEach(indicator => {
                const promise = new Promise((resolve, reject) => {
                    const query = `
                        INSERT OR REPLACE INTO daily_indicators
                        (id, academic_period_id, teacher_id, grade_level, subject_area, indicator_name, parent_indicator_id, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    `;
                    const parentId = indicator.isSubIndicator ? indicator.parentId : null;
                    database.db.run(
                        query,
                        [
                            indicator.id,
                            academic_period_id ? parseInt(academic_period_id) : 1,
                            teacher_id,
                            grade_level,
                            subject_area,
                            indicator.text,
                            parentId
                        ],
                        function(err) {
                        if (err) reject(err);
                        else resolve(this);
                        }
                    );
                });
                indicatorPromises.push(promise);
            });
        }
        
        await Promise.all(indicatorPromises);
        console.log('✅ Indicadores guardados');
        
        // 2. Guardar evaluaciones de estudiantes
        let savedStudents = 0;
        const studentPromises = [];
        
        if (students && Object.keys(students).length > 0) {
            
            // 🔧 OPTIMIZACIÓN: Pre-cargar y mapear estudiantes del grado UNA SOLA VEZ
            console.log(`🎓 Pre-cargando estudiantes del grado ${grade_level}...`);
            
            const studentsInGradeQuery = `
                SELECT id, 
                       (first_surname || ' ' || COALESCE(second_surname, '') || ' ' || first_name) as full_name,
                       first_surname, second_surname, first_name
                FROM students 
                WHERE grade_level = ? AND status = 'active'
            `;
            
            const studentsInGrade = await new Promise((resolve, reject) => {
                database.db.all(studentsInGradeQuery, [grade_level], (err, rows) => {
                    if (err) {
                        console.error('❌ Error cargando estudiantes del grado:', err);
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            });
            
            console.log(`👥 Estudiantes pre-cargados: ${studentsInGrade.length}`);
            
            // 🔧 CREAR MAPA DE BÚSQUEDA EFICIENTE
            const studentSearchMap = new Map();
            studentsInGrade.forEach(student => {
                const normalizedName = student.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
                studentSearchMap.set(normalizedName, student);
                
                // También agregar variaciones posibles para búsqueda flexible
                const nameVariations = [
                    student.full_name.trim(),
                    `${student.first_surname} ${student.first_name}`.trim(),
                    `${student.first_surname} ${student.second_surname || ''} ${student.first_name}`.trim()
                ].map(name => name.toLowerCase().replace(/\s+/g, ' '));
                
                nameVariations.forEach(variation => {
                    if (variation && !studentSearchMap.has(variation)) {
                        studentSearchMap.set(variation, student);
                    }
                });
            });
            
            console.log(`🗂️ Mapa de búsqueda creado con ${studentSearchMap.size} entradas`);
            
            // 🔧 PROCESAR CADA ESTUDIANTE CON BÚSQUEDA OPTIMIZADA
            for (const [studentName, scores] of Object.entries(students)) {
                const studentPromise = new Promise((resolve, reject) => {
                    console.log(`🔍 Buscando estudiante: "${studentName}"`);
                    
                    // Búsqueda optimizada usando el mapa
                    const normalizedSearchName = studentName.trim().toLowerCase().replace(/\s+/g, ' ');
                    const foundStudent = studentSearchMap.get(normalizedSearchName);
                    
                    if (!foundStudent) {
                        console.log(`⚠️ Estudiante no encontrado: "${studentName}"`);
                        console.log(`📋 Estudiantes disponibles en ${grade_level}:`, 
                            Array.from(studentSearchMap.keys()).slice(0, 5).join(', ') + '...');
                        resolve(null);
                        return;
                    }
                    
                    console.log(`✅ Estudiante encontrado: ${foundStudent.full_name} (ID: ${foundStudent.id})`);
                    
                    // Crear/actualizar evaluación del estudiante
                    const evalQuery = `
                        INSERT OR REPLACE INTO daily_evaluations
                        (student_id, academic_period_id, teacher_id, grade_level, subject_area, evaluation_date, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    `;

                    database.db.run(
                        evalQuery,
                        [
                            foundStudent.id,
                            academic_period_id ? parseInt(academic_period_id) : 1,
                            teacher_id,
                            grade_level,
                            subject_area,
                            evaluation_date
                        ],
                        function(evalErr) {
                        if (evalErr) {
                            console.error('❌ Error creando evaluación:', evalErr);
                            reject(evalErr);
                            return;
                        }
                        
                        const evaluationId = this.lastID;
                        console.log(`📝 Evaluación creada con ID: ${evaluationId}`);
                        
                        // Guardar calificaciones por indicador
                        const scorePromises = [];
                        
                        for (const [indicatorId, score] of Object.entries(scores)) {
                            const scorePromise = new Promise((scoreResolve, scoreReject) => {
                                const scoreQuery = `
                                    INSERT OR REPLACE INTO daily_indicator_scores 
                                    (daily_evaluation_id, daily_indicator_id, score, created_at)
                                    VALUES (?, ?, ?, datetime('now'))
                                `;
                                database.db.run(scoreQuery, [evaluationId, indicatorId, score], function(scoreErr) {
                                    if (scoreErr) {
                                        console.error('❌ Error guardando calificación:', scoreErr);
                                        scoreReject(scoreErr);
                                    } else {
                                        console.log(`✅ Calificación guardada: Indicador ${indicatorId} = ${score}`);
                                        scoreResolve();
                                    }
                                });
                            });
                            scorePromises.push(scorePromise);
                        }
                        
                        Promise.all(scorePromises)
                            .then(() => {
                                console.log(`✅ Todas las calificaciones guardadas para ${foundStudent.full_name}`);
                                savedStudents++;
                                resolve(foundStudent);
                            })
                            .catch(reject);
                    });
                });
                
                studentPromises.push(studentPromise);
            }
        }
        
        // ✅ ESPERAR a que se guarden TODOS los estudiantes
        const results = await Promise.allSettled(studentPromises);
        const successfulSaves = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        
        console.log(`💾 Proceso completado: ${successfulSaves} estudiantes guardados de ${Object.keys(students || {}).length} enviados`);
        
        res.json({ 
            success: true,
            data: {
                saved_students: successfulSaves,
                total_sent: Object.keys(students || {}).length,
                date: evaluation_date,
                grade: grade_level,
                subject: subject_area,
                indicators: indicators?.length || 0
            },
            message: `Evaluación guardada: ${successfulSaves} estudiantes, ${indicators?.length || 0} indicadores` 
        });
        
    } catch (error) {
        console.error('❌ Error guardando evaluación cotidiano:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error guardando evaluación',
            error: error.message 
        });
    }
});

// Nuevo endpoint: Obtener indicadores de fecha más reciente (opcional)
app.get('/api/cotidiano/latest-indicators', authenticateTeacher, async (req, res) => {
    try {
        const { grade_level, subject_area, academic_period_id } = req.query;
        const teacher_id = req.query.teacher_id || req.teacher.id;
        
        if (!grade_level || !subject_area) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }
        
        console.log('🔍 Buscando indicadores más recientes para:', { grade_level, subject_area });
        
        database.ensureConnection();
        
        // Buscar la fecha más reciente con evaluaciones
        const latestDateQuery = `
            SELECT evaluation_date
            FROM daily_evaluations
            WHERE grade_level = ? AND subject_area = ? AND academic_period_id = ? AND teacher_id = ?
            ORDER BY evaluation_date DESC
            LIMIT 1
        `;

        const latestDate = await new Promise((resolve, reject) => {
            database.db.get(latestDateQuery, [grade_level, subject_area, academic_period_id ? parseInt(academic_period_id) : 1, teacher_id], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.evaluation_date : null);
            });
        });
        
        if (!latestDate) {
            return res.json({
                success: false,
                message: 'No se encontraron evaluaciones previas para este grado y materia'
            });
        }
        
        console.log(`📅 Fecha más reciente encontrada: ${latestDate}`);
        
        // Obtener indicadores de esa fecha (con el mismo enfoque que el endpoint principal)
        const indicatorsWithScoresQuery = `
            SELECT DISTINCT di.*
            FROM daily_indicators di
            INNER JOIN daily_indicator_scores dis ON di.id = dis.daily_indicator_id
            INNER JOIN daily_evaluations de ON dis.daily_evaluation_id = de.id
            WHERE de.grade_level = ? AND de.subject_area = ? AND de.evaluation_date = ? AND de.academic_period_id = ? AND de.teacher_id = ?
        `;

        const indicatorsWithScores = await new Promise((resolve, reject) => {
            database.db.all(indicatorsWithScoresQuery, [grade_level, subject_area, latestDate, academic_period_id ? parseInt(academic_period_id) : 1, teacher_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Obtener indicadores principales
        const parentIds = [...new Set(
            indicatorsWithScores
                .filter(ind => ind.parent_indicator_id)
                .map(ind => ind.parent_indicator_id)
        )];
        
        let parentIndicators = [];
        if (parentIds.length > 0) {
            const placeholders = parentIds.map(() => '?').join(',');
            const parentsQuery = `
                SELECT * FROM daily_indicators
                WHERE id IN (${placeholders}) AND grade_level = ? AND subject_area = ? AND academic_period_id = ? AND teacher_id = ?
            `;

            parentIndicators = await new Promise((resolve, reject) => {
                database.db.all(parentsQuery, [...parentIds, grade_level, subject_area, academic_period_id ? parseInt(academic_period_id) : 1, teacher_id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        }
        
        // Combinar y ordenar
        const allIndicators = [...parentIndicators, ...indicatorsWithScores];
        allIndicators.sort((a, b) => {
            if (!a.parent_indicator_id && b.parent_indicator_id) return -1;
            if (a.parent_indicator_id && !b.parent_indicator_id) return 1;
            return a.id - b.id;
        });
        
        console.log(`📋 Indicadores encontrados: ${allIndicators.length}`);
        
        res.json({
            success: true,
            data: {
                indicators: allIndicators,
                latest_date: latestDate
            },
            message: `${allIndicators.length} indicadores encontrados de fecha ${latestDate}`
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo indicadores previos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo indicadores previos',
            error: error.message
        });
    }
});

// Obtener historial de evaluaciones
app.get('/api/cotidiano/history', authenticateTeacher, async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grade and subject are required' 
            });
        }
        
        const history = await database.getCotidianoHistory(grade, subject);
        
        res.json({
            success: true,
            data: history,
            message: `${history.length} evaluaciones encontradas en el historial`
        });
        
    } catch (error) {
        console.error('Error in get history API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo historial',
            error: error.message 
        });
    }
});

// ========================================
// MÓDULO SEA - Sistema de Evaluación Académica
// AGREGAR ESTE CÓDIGO AL FINAL DE server.js (ANTES DE startServer())
// ========================================

// Endpoint para obtener lista de grados y materias disponibles para SEA
app.get('/api/sea/grade-subjects', authenticateTeacher, async (req, res) => {
    try {
        console.log('🎯 GET /api/sea/grade-subjects - Obteniendo combinaciones para SEA');

        const { year, period_type, period_number, academic_period_id } = req.query;

        let academicPeriodId = academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        // Obtener asignaciones usando la función existente filtrando por profesor y período
        const gradesWithSubjects = await database.getAllGradesWithSubjects(req.teacher.id, academicPeriodId);
        console.log(`📚 Grados con materias encontrados: ${gradesWithSubjects.length}`);
        
        // Crear array de combinaciones
        const seaGradeSubjects = [];
        
        gradesWithSubjects.forEach(gradeData => {
            console.log(`🔍 Procesando grado: ${gradeData.gradeName}, materias: ${gradeData.subjects?.length || 0}`);
            
            if (gradeData.subjects && gradeData.subjects.length > 0) {
                // ✅ CORRECCIÓN: subjects es un array de strings, no objetos
                gradeData.subjects.forEach(subject => {
                    // subject ya es un string, no un objeto
                    seaGradeSubjects.push({
                        grade_level: gradeData.gradeName,  // ✅ CORRECCIÓN: usar gradeName
                        subject_area: subject              // ✅ CORRECCIÓN: subject ya es string
                    });
                    console.log(`   📖 ${gradeData.gradeName} - ${subject}`);
                });
            } else {
                console.log(`   ⚠️ ${gradeData.gradeName}: Sin materias asignadas`);
            }
        });

        console.log(`✅ SEA: ${seaGradeSubjects.length} combinaciones finales`);

        // Si no hay combinaciones, ofrecer información de debug
        if (seaGradeSubjects.length === 0) {
            console.log('⚠️ No se encontraron combinaciones grado-materia para SEA');
            
            // Verificar si al menos hay grados
            const grades = await database.getAllGrades();
            console.log(`📚 Grados en sistema: ${grades?.length || 0}`);
            
            res.json({
                success: true,
                data: [],
                debug: {
                    grades_found: grades?.length || 0,
                    assignments_found: gradesWithSubjects.length,
                    available_grades: grades?.map(g => g.name) || []
                },
                message: grades?.length > 0 
                    ? 'Se encontraron grados pero no hay asignaciones de materias. Vaya al módulo de Estudiantes para asignar materias a los grados.'
                    : 'No hay grados en el sistema. Agregue grados primero.'
            });
            return;
        }

        res.json({
            success: true,
            data: seaGradeSubjects,
            message: `${seaGradeSubjects.length} combinaciones grado-materia encontradas`
        });
        
    } catch (error) {
        console.error('❌ Error en /api/sea/grade-subjects:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos para SEA',
            error: error.message
        });
    }
});

// Endpoint principal para datos consolidados del SEA
app.get('/api/sea/consolidated', authenticateTeacher, async (req, res) => {
    try {
        const { grade, subject, year, period_type, period_number, academic_period_id } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }

        console.log(`🎯 GET /api/sea/consolidated - Grado: ${grade}, Materia: ${subject}`);

        let academicPeriodId = academic_period_id || null;

        if (!academicPeriodId && year && period_type && period_number) {
            academicPeriodId = await getOrCreateAcademicPeriodId(year, period_type, period_number);
        }

        if (!academicPeriodId) {
            const currentPeriodQuery = 'SELECT id FROM academic_periods WHERE is_current = 1 LIMIT 1';
            const currentPeriod = await new Promise((resolve, reject) => {
                database.db.get(currentPeriodQuery, [], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            academicPeriodId = currentPeriod ? currentPeriod.id : 1;
        }

        database.ensureConnection();

        // 1. Obtener todas las evaluaciones activas del grado/materia
        const evaluations = await new Promise((resolve, reject) => {
            const evaluationsQuery = `
                SELECT id, title, percentage, max_points, type, due_date
                FROM assignments
                WHERE grade_level = ? AND subject_area = ? AND is_active = 1
                    AND teacher_id = ? AND academic_period_id = ?
                ORDER BY created_at DESC
            `;

            database.db.all(evaluationsQuery, [grade, subject, req.teacher.id, academicPeriodId], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo evaluaciones:', err);
                    reject(err);
                } else {
                    console.log(`📝 Evaluaciones encontradas: ${rows?.length || 0}`);
                    resolve(rows || []);
                }
            });
        });

        // 2. Obtener todos los estudiantes activos del grado
        const students = await new Promise((resolve, reject) => {
            const studentsQuery = `
                SELECT id, first_name, first_surname, second_surname, student_id, cedula
                FROM students
                WHERE grade_level = ? AND status = 'active'
                    AND teacher_id = ? AND academic_period_id = ?
                ORDER BY first_surname, first_name
            `;

            database.db.all(studentsQuery, [grade, req.teacher.id, academicPeriodId], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo estudiantes:', err);
                    reject(err);
                } else {
                    console.log(`👥 Estudiantes encontrados: ${rows?.length || 0}`);
                    resolve(rows || []);
                }
            });
        });

        // 3. Para cada estudiante, obtener todas sus notas
        const studentsWithSEA = [];
        
        for (const student of students) {
            const studentName = `${student.first_surname} ${student.second_surname || ''} ${student.first_name}`.trim();
            
            try {
                // 3.1 Calificaciones en evaluaciones
                const evaluationGrades = {};
                let totalWeightedGrade = 0;
                let totalPercentage = 0;
                
                for (const evaluation of evaluations) {
                    const gradeResult = await new Promise((resolve, reject) => {
                        const gradeQuery = `
                            SELECT points_earned, grade, percentage 
                            FROM assignment_grades 
                            WHERE assignment_id = ? AND student_id = ?
                        `;
                        
                        database.db.get(gradeQuery, [evaluation.id, student.id], (err, row) => {
                            if (err) {
                                console.error(`❌ Error obteniendo calificación estudiante ${student.id}, evaluación ${evaluation.id}:`, err);
                                resolve(null); // No fallar por un estudiante
                            } else {
                                resolve(row);
                            }
                        });
                    });
                    
                    if (gradeResult && gradeResult.points_earned !== null) {
                        const studentGrade = (gradeResult.points_earned / evaluation.max_points) * 100;
                        totalWeightedGrade += studentGrade * (evaluation.percentage / 100);
                        totalPercentage += evaluation.percentage;
                        
                        // Calcular puntos obtenidos del porcentaje total
                        const pointsFromPercentage = (studentGrade / 100) * evaluation.percentage;
                        
                        evaluationGrades[evaluation.title] = {
                            grade: pointsFromPercentage.toFixed(1), // Puntos obtenidos del porcentaje
                            percentage: evaluation.percentage,
                            points: `${gradeResult.points_earned}/${evaluation.max_points}`,
                            original_grade: studentGrade.toFixed(1) // Guardar nota original para debug
                        };
                    } else {
                        evaluationGrades[evaluation.title] = {
                            grade: 'Sin calificar',
                            percentage: evaluation.percentage,
                            points: '-',
                            original_grade: 'Sin calificar'
                        };
                    }
                }

                // 3.2 Nota de cotidiano total (calcular de TODAS las fechas)
                const cotidianoResult = await new Promise((resolve, reject) => {
                    // Query para obtener TODAS las evaluaciones de cotidiano del estudiante
                    const cotidianoQuery = `
                        SELECT
                            de.evaluation_date,
                            COUNT(dis.score) as total_scores,
                            SUM(dis.score) as suma_scores,
                            AVG(dis.score) as avg_score_date
                        FROM daily_evaluations de
                        LEFT JOIN daily_indicator_scores dis ON de.id = dis.daily_evaluation_id
                        WHERE de.student_id = ? AND de.grade_level = ? AND de.subject_area = ?
                            AND de.teacher_id = ? AND de.academic_period_id = ?
                        GROUP BY de.evaluation_date
                        ORDER BY de.evaluation_date DESC
                    `;

                    database.db.all(cotidianoQuery, [student.id, grade, subject, req.teacher.id, academicPeriodId], (err1, rows) => {
                        if (err1) {
                            console.error(`❌ Error obteniendo cotidiano estudiante ${student.id}:`, err1);
                            resolve(null);
                            return;
                        }
                        
                        if (rows && rows.length > 0) {
                            console.log(`🔍 ${student.first_surname}: ${rows.length} fechas de cotidiano encontradas`);
                            
                            let sumaPromedios = 0;
                            let totalFechas = 0;
                            const porcentajeTotal = 65; // Valor por defecto, podrías hacerlo configurable
                            
                            // Calcular promedio de todas las fechas (igual que en el frontend)
                            rows.forEach(row => {
                                if (row.total_scores > 0) {
                                    // Máximo posible para esta fecha
                                    const maxPosibleFecha = row.total_scores * 3;
                                    
                                    // Porcentaje de esta fecha
                                    const porcentajeFecha = (row.suma_scores / maxPosibleFecha) * 100;
                                    sumaPromedios += porcentajeFecha;
                                    totalFechas++;
                                    
                                    console.log(`   📅 ${row.evaluation_date}: ${row.suma_scores}/${maxPosibleFecha} = ${porcentajeFecha.toFixed(1)}%`);
                                }
                            });
                            
                            if (totalFechas > 0) {
                                // Calcular cotidiano total (igual que en el frontend)
                                const promedioGeneral = sumaPromedios / totalFechas;
                                const cotidianoTotal = Math.round((promedioGeneral * porcentajeTotal) / 100);
                                
                                console.log(`📊 Cotidiano ${student.first_surname} calculado: ${cotidianoTotal} (${totalFechas} fechas, promedio: ${promedioGeneral.toFixed(1)}%)`);
                                resolve({ cotidiano_total: cotidianoTotal, evaluation_date: rows[0].evaluation_date });
                            } else {
                                console.log(`📊 ${student.first_surname}: Sin datos válidos para cotidiano`);
                                resolve(null);
                            }
                            return;
                        }
                        
                        // Si no encuentra con materia exacta, buscar en cualquier materia del grado
                        console.log(`🔍 Buscando cotidiano ${student.first_surname} en cualquier materia de ${grade}...`);
                        const cotidianoQuery2 = `
                            SELECT
                                de.evaluation_date,
                                de.subject_area,
                                COUNT(dis.score) as total_scores,
                                SUM(dis.score) as suma_scores
                            FROM daily_evaluations de
                            LEFT JOIN daily_indicator_scores dis ON de.id = dis.daily_evaluation_id
                            WHERE de.student_id = ? AND de.grade_level = ?
                                AND de.teacher_id = ? AND de.academic_period_id = ?
                            GROUP BY de.evaluation_date, de.subject_area
                            ORDER BY de.evaluation_date DESC
                        `;

                        database.db.all(cotidianoQuery2, [student.id, grade, req.teacher.id, academicPeriodId], (err2, rows2) => {
                            if (err2) {
                                console.error(`❌ Error en búsqueda general cotidiano:`, err2);
                                resolve(null);
                            } else if (rows2 && rows2.length > 0) {
                                console.log(`🔍 ${student.first_surname}: ${rows2.length} registros en otras materias`);
                                
                                // Tomar la materia con más datos o la más reciente
                                const materiaConMasDatos = rows2.reduce((prev, current) => {
                                    return (current.total_scores > prev.total_scores) ? current : prev;
                                });
                                
                                console.log(`📊 Cotidiano ${student.first_surname} (${grade}-${materiaConMasDatos.subject_area}): Usando datos de otra materia`);
                                
                                // Para simplificar, tomar solo la evaluación más reciente de la otra materia
                                if (materiaConMasDatos.total_scores > 0) {
                                    const porcentaje = (materiaConMasDatos.suma_scores / (materiaConMasDatos.total_scores * 3)) * 100;
                                    const cotidianoTotal = Math.round((porcentaje * 65) / 100);
                                    resolve({ cotidiano_total: cotidianoTotal, evaluation_date: materiaConMasDatos.evaluation_date });
                                } else {
                                    resolve(null);
                                }
                            } else {
                                console.log(`📊 ${student.first_surname}: Sin registros de cotidiano en ${grade}`);
                                resolve(null);
                            }
                        });
                    });
                });

                // 3.3 Nota de asistencia (usando función correcta y materia específica)
                let attendanceStats = null;
                try {
                    // Primero intentar con la materia específica
                    attendanceStats = await database.calculateMEPAttendanceGrade(student.id, grade, subject, undefined, academicPeriodId);
                    console.log(`📊 Asistencia estudiante ${student.first_surname} (${subject}): ${attendanceStats?.nota_asistencia || 'Sin datos'}`);
                    
                    // Si no hay datos con la materia específica, intentar con 'general'
                    if (!attendanceStats || attendanceStats.total_records === 0) {
                        console.log(`🔍 Intentando asistencia general para ${student.first_surname}...`);
                        attendanceStats = await database.calculateMEPAttendanceGrade(student.id, grade, 'general', undefined, academicPeriodId);
                        console.log(`📊 Asistencia estudiante ${student.first_surname} (general): ${attendanceStats?.nota_asistencia || 'Sin datos'}`);
                    }
                } catch (error) {
                    console.error(`❌ Error obteniendo asistencia estudiante ${student.id}:`, error);
                }

                // 3.4 Calcular nota SEA de evaluaciones
                const seaEvaluationsGrade = totalPercentage > 0 ? (totalWeightedGrade / totalPercentage * 100) : 0;

                studentsWithSEA.push({
                    student_id: student.id,
                    student_code: student.student_id,
                    student_cedula: student.cedula,
                    student_name: studentName,
                    
                    // Evaluaciones individuales
                    evaluations: evaluationGrades,
                    evaluations_summary: {
                        weighted_grade: seaEvaluationsGrade.toFixed(1),
                        total_percentage: totalPercentage,
                        completed_evaluations: Object.values(evaluationGrades).filter(e => e.grade !== 'Sin calificar').length,
                        total_evaluations: evaluations.length
                    },
                    
                    // Nota de cotidiano total
                    cotidiano: {
                        total_grade: cotidianoResult?.cotidiano_total ? cotidianoResult.cotidiano_total.toFixed(1) : 'Sin datos',
                        last_evaluation_date: cotidianoResult?.evaluation_date || null
                    },
                    
                    // Nota de asistencia (solo una columna)
                    attendance: {
                        grade_0_5: attendanceStats?.nota_asistencia ? attendanceStats.nota_asistencia.toFixed(1) : 'Sin datos',
                        total_lessons: attendanceStats?.total_lessons || 0,
                        attendance_percentage: attendanceStats?.attendance_percentage ? attendanceStats.attendance_percentage.toFixed(1) : 'Sin datos'
                    }
                });

            } catch (studentError) {
                console.error(`❌ Error procesando estudiante ${student.id}:`, studentError);
                // Continuar con el siguiente estudiante
            }
        }

        // 4. Obtener configuración de pesos (valores que suman hacia 100)
        const weightConfig = {
            cotidiano_weight: 65, // 65 puntos del total
            attendance_weight: 10,  // 10 puntos del total 
            evaluations_weight: 25 // 25 puntos restantes (o lo que tengan configurado las evaluaciones)
        };

        console.log(`✅ SEA procesado: ${studentsWithSEA.length} estudiantes completados`);

        res.json({
            success: true,
            data: {
                students: studentsWithSEA,
                evaluations_list: evaluations,
                weight_config: weightConfig,
                summary: {
                    total_students: students.length,
                    total_evaluations: evaluations.length,
                    grade_level: grade,
                    subject_area: subject,
                    total_percentage_configured: evaluations.reduce((sum, e) => sum + e.percentage, 0),
                    cotidiano_weight: weightConfig.cotidiano_weight,
                    attendance_weight: weightConfig.attendance_weight
                }
            },
            message: `Datos SEA cargados: ${students.length} estudiantes, ${evaluations.length} evaluaciones`
        });
        
    } catch (error) {
        console.error('❌ Error en /api/sea/consolidated:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos SEA',
            error: error.message
        });
    }
});



// ========================================
// APIs DE AUTENTICACIÓN ADMINISTRATIVA
// ========================================

// Login administrativo
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Verificar credenciales específicas del administrador
        const trimmedEmail = email ? email.trim().toLowerCase() : '';
        if (trimmedEmail === 'luiscraft' && password === 'Naturarte0603') {
            // Actualizar último login
            await database.updateAdminLastLogin();
            
            res.json({
                success: true,
                message: 'Acceso administrativo autorizado',
                user: {
                    email: email,
                    role: 'super_admin',
                    loginTime: new Date().toISOString()
                }
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Credenciales inválidas. Acceso denegado.'
            });
        }
        
    } catch (error) {
        console.error('Error en login administrativo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Verificar sesión administrativa
app.get('/api/admin/verify', (req, res) => {
    // En una implementación real, aquí verificarías JWT o sesión
    // Por simplicidad, solo confirmamos que el endpoint existe
    res.json({
        success: true,
        message: 'Endpoint de verificación disponible'
    });
});

// Logout administrativo
app.post('/api/admin/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Sesión administrativa cerrada'
    });
});


// ========================================
// NUEVAS RUTAS PARA FUNCIONALIDAD ADMIN
// ========================================

// Toggle payment status
app.put('/api/teachers/:id/toggle-payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_paid } = req.body;
        
        const result = await database.updateTeacherPayment(id, is_paid);
        res.json({
            success: true,
            data: result,
            message: `Estado de pago ${is_paid ? 'activado' : 'desactivado'}`
        });
    } catch (error) {
        console.error('Error actualizando pago:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando estado de pago',
            error: error.message
        });
    }
});

// Obtener sesiones activas (simulado)
app.get('/api/sessions', (req, res) => {
    // En implementación real, aquí consultarías sesiones activas de la BD
    const mockSessions = [
        {
            id: 1,
            teacher_name: 'Usuario Demo',
            email: 'demo@example.com',
            ip: '127.0.0.1',
            last_activity: new Date(),
            status: 'active'
        }
    ];
    
    res.json({
        success: true,
        data: mockSessions
    });
});



// Obtener sesiones activas usando la base de datos real
app.get('/api/sessions/active', async (req, res) => {
    try {
        const sessions = await database.getActiveSessions();
        res.json({
            success: true,
            data: sessions,
            count: sessions.length
        });
    } catch (error) {
        console.error('Error obteniendo sesiones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo sesiones activas',
            error: error.message
        });
    }
});

// Logout de profesor con limpieza de sesión
app.post('/api/teachers/logout', async (req, res) => {
    try {
        const { sessionToken } = req.body;
        
        if (sessionToken) {
            await database.deleteActiveSession(sessionToken);
            console.log('✅ Sesión cerrada correctamente');
        }
        
        res.json({
            success: true,
            message: 'Sesión cerrada'
        });
    } catch (error) {
        console.error('Error en logout:', error);
        res.json({
            success: true,
            message: 'Sesión cerrada (con errores menores)'
        });
    }
});



// ========================================
// RUTAS API PARA PERÍODOS ACADÉMICOS
// ========================================

// Obtener todos los períodos académicos
app.get('/api/academic-periods', async (req, res) => {
    try {
        const { year, active_only } = req.query;
        
        let query = 'SELECT * FROM academic_periods';
        let params = [];
        
        if (year) {
            query += ' WHERE year = ?';
            params.push(year);
        }
        
        if (active_only === 'true') {
            query += (year ? ' AND' : ' WHERE') + ' is_active = 1';
        }
        
        query += ' ORDER BY year DESC, period_number ASC';
        
        database.db.all(query, params, (err, rows) => {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Error obteniendo períodos académicos',
                    error: err.message
                });
            } else {
                res.json({
                    success: true,
                    data: rows,
                    message: `${rows.length} períodos encontrados`
                });
            }
        });
    } catch (error) {
        console.error('Error obteniendo períodos académicos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo períodos académicos',
            error: error.message
        });
    }
});

// Obtener período académico actual
app.get('/api/academic-periods/current', async (req, res) => {
    try {
        const query = 'SELECT * FROM academic_periods WHERE is_current = 1 LIMIT 1';
        
        database.db.get(query, [], (err, row) => {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Error obteniendo período actual',
                    error: err.message
                });
            } else if (row) {
                res.json({
                    success: true,
                    data: row
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'No hay período académico activo'
                });
            }
        });
    } catch (error) {
        console.error('Error obteniendo período actual:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo período actual',
            error: error.message
        });
    }
});

// Crear nuevo período académico
app.post('/api/academic-periods', async (req, res) => {
    try {
        console.log('📅 POST /api/academic-periods:', req.body);
        
        const { year, period_type, period_number, name, start_date, end_date } = req.body;
        
        if (!year || !period_type || !period_number || !name) {
            return res.status(400).json({
                success: false,
                message: 'Año, tipo de período, número y nombre son requeridos'
            });
        }
        
        const query = `
            INSERT INTO academic_periods (year, period_type, period_number, name, start_date, end_date, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `;
        
        database.db.run(query, [year, period_type, period_number, name, start_date, end_date], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({
                        success: false,
                        message: 'Ya existe un período con ese año, tipo y número'
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        message: 'Error creando período académico',
                        error: err.message
                    });
                }
            } else {
                res.json({
                    success: true,
                    data: {
                        id: this.lastID,
                        year,
                        period_type,
                        period_number,
                        name
                    },
                    message: 'Período académico creado exitosamente'
                });
            }
        });
    } catch (error) {
        console.error('Error creando período académico:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando período académico',
            error: error.message
        });
    }
});

// Activar período académico (marca como actual)
app.put('/api/academic-periods/:id/activate', async (req, res) => {
    try {
        const periodId = req.params.id;
        console.log(`📅 PUT /api/academic-periods/${periodId}/activate`);
        
        // Primero desactivar todos los períodos actuales
        const deactivateQuery = 'UPDATE academic_periods SET is_current = 0';
        
        database.db.run(deactivateQuery, [], (err) => {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Error desactivando períodos anteriores',
                    error: err.message
                });
                return;
            }
            
            // Activar el período seleccionado
            const activateQuery = 'UPDATE academic_periods SET is_current = 1 WHERE id = ?';
            
            database.db.run(activateQuery, [periodId], function(err) {
                if (err) {
                    res.status(500).json({
                        success: false,
                        message: 'Error activando período',
                        error: err.message
                    });
                } else if (this.changes === 0) {
                    res.status(404).json({
                        success: false,
                        message: 'Período no encontrado'
                    });
                } else {
                    res.json({
                        success: true,
                        message: 'Período académico activado',
                        data: { id: periodId }
                    });
                }
            });
        });
    } catch (error) {
        console.error('Error activando período académico:', error);
        res.status(500).json({
            success: false,
            message: 'Error activando período académico',
            error: error.message
        });
    }
});

// Obtener escuelas disponibles
app.get('/api/schools', async (req, res) => {
    try {
        const query = 'SELECT * FROM schools ORDER BY name ASC';
        
        database.db.all(query, [], (err, rows) => {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Error obteniendo escuelas',
                    error: err.message
                });
            } else {
                res.json({
                    success: true,
                    data: rows,
                    message: `${rows.length} escuelas encontradas`
                });
            }
        });
    } catch (error) {
        console.error('Error obteniendo escuelas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo escuelas',
            error: error.message
        });
    }
});

// Crear nueva escuela
app.post('/api/schools', async (req, res) => {
    try {
        console.log('🏫 POST /api/schools:', req.body);
        
        const { name, address, phone, email } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la escuela es requerido'
            });
        }
        
        const query = `
            INSERT INTO schools (name, address, phone, email)
            VALUES (?, ?, ?, ?)
        `;
        
        database.db.run(query, [name, address, phone, email], function(err) {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Error creando escuela',
                    error: err.message
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        id: this.lastID,
                        name,
                        address,
                        phone,
                        email
                    },
                    message: 'Escuela creada exitosamente'
                });
            }
        });
    } catch (error) {
        console.error('Error creando escuela:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando escuela',
            error: error.message
        });
    }
});

// API para cambiar período globalmente (para el frontend)
app.post('/api/academic-periods/set-current', async (req, res) => {
    try {
        const { year, period_type, period_number } = req.body;
        console.log('📅 POST /api/academic-periods/set-current:', req.body);
        
        if (!year || !period_type || !period_number) {
            return res.status(400).json({
                success: false,
                message: 'Año, tipo de período y número son requeridos'
            });
        }
        
        // ========================================
        // PASO 1: BUSCAR SI YA EXISTE EL PERÍODO
        // ========================================
        const findQuery = `
            SELECT id FROM academic_periods 
            WHERE year = ? AND period_type = ? AND period_number = ?
        `;
        
        database.db.get(findQuery, [year, period_type, period_number], (err, existingPeriod) => {
            if (err) {
                console.error('❌ Error buscando período:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error buscando período',
                    error: err.message
                });
            }
            
            if (existingPeriod) {
                // ========================================
                // CASO A: EL PERÍODO YA EXISTE - SOLO ACTIVARLO
                // ========================================
                console.log('✅ Período encontrado, activando ID:', existingPeriod.id);
                activatePeriod(existingPeriod.id, { year, period_type, period_number });
            } else {
                // ========================================
                // CASO B: EL PERÍODO NO EXISTE - CREARLO PRIMERO
                // ========================================
                console.log('📝 Período no existe, creando nuevo...');
                
                const periodName = `${year} - ${period_number === 1 ? 'Primer' : period_number === 2 ? 'Segundo' : 'Tercer'} ${period_type === 'semester' ? 'Semestre' : 'Trimestre'}`;
                
                const createQuery = `
                    INSERT INTO academic_periods (year, period_type, period_number, name, is_active, is_current)
                    VALUES (?, ?, ?, ?, 1, 0)
                `;
                
                database.db.run(createQuery, [year, period_type, period_number, periodName], function(createErr) {
                    if (createErr) {
                        console.error('❌ Error creando período:', createErr);
                        
                        // Si es error de duplicado, buscar el período existente
                        if (createErr.message.includes('UNIQUE constraint failed')) {
                            console.log('🔄 Error de duplicado, buscando período existente...');
                            database.db.get(findQuery, [year, period_type, period_number], (findErr, foundPeriod) => {
                                if (findErr || !foundPeriod) {
                                    return res.status(500).json({
                                        success: false,
                                        message: 'Error verificando período duplicado',
                                        error: findErr?.message || 'Período no encontrado'
                                    });
                                }
                                
                                console.log('✅ Período encontrado después de duplicado, activando ID:', foundPeriod.id);
                                activatePeriod(foundPeriod.id, { year, period_type, period_number });
                            });
                        } else {
                            return res.status(500).json({
                                success: false,
                                message: 'Error creando período',
                                error: createErr.message
                            });
                        }
                        return;
                    }
                    
                    console.log('✅ Período creado exitosamente con ID:', this.lastID);
                    activatePeriod(this.lastID, { year, period_type, period_number });
                });
            }
        });
        
        // ========================================
        // FUNCIÓN INTERNA PARA ACTIVAR PERÍODO
        // ========================================
        function activatePeriod(periodId, periodData) {
            console.log('🔄 Activando período ID:', periodId);
            
            // Primero desactivar todos los períodos actuales
            const deactivateQuery = 'UPDATE academic_periods SET is_current = 0';
            
            database.db.run(deactivateQuery, [], (deactivateErr) => {
                if (deactivateErr) {
                    console.error('❌ Error desactivando períodos:', deactivateErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Error desactivando períodos anteriores',
                        error: deactivateErr.message
                    });
                }
                
                console.log('✅ Períodos anteriores desactivados');
                
                // Ahora activar el período seleccionado
                const activateQuery = 'UPDATE academic_periods SET is_current = 1 WHERE id = ?';
                
                database.db.run(activateQuery, [periodId], function(activateErr) {
                    if (activateErr) {
                        console.error('❌ Error activando período:', activateErr);
                        return res.status(500).json({
                            success: false,
                            message: 'Error activando período',
                            error: activateErr.message
                        });
                    }
                    
                    console.log('✅ Período activado exitosamente');
                    
                    // Respuesta exitosa
                    res.json({
                        success: true,
                        message: 'Período académico establecido como actual',
                        data: { 
                            periodId: periodId,
                            year: periodData.year,
                            period_type: periodData.period_type,
                            period_number: periodData.period_number
                        }
                    });
                });
            });
        }
        
    } catch (error) {
        console.error('❌ Error general estableciendo período actual:', error);
        res.status(500).json({
            success: false,
            message: 'Error estableciendo período actual',
            error: error.message
        });
    }
});


// Obtener información del profesor logueado (VERSIÓN REAL CON AUTENTICACIÓN)
app.get('/api/teachers/current', authenticateTeacher, async (req, res) => {
    try {
        // ✅ DATOS REALES del profesor autenticado (no mock)
        res.json({
            success: true,
            data: {
                id: req.teacher.id,           // ID real del profesor logueado
                full_name: req.teacher.name,  // Nombre real del profesor logueado
                school_name: req.teacher.school, // Escuela real del profesor logueado
                email: req.teacher.email,     // Email real del profesor logueado
                cedula: req.teacher.cedula || 'No disponible' // Cédula si está disponible
            }
        });
    } catch (error) {
        console.error('Error obteniendo profesor actual:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos del profesor',
            error: error.message
        });
    }
});

// Iniciar todo
startServer();

// Cerrar base de datos al terminar el proceso
process.on('SIGINT', () => {
    console.log('🔄 Cerrando servidor...');
    database.close();
    process.exit(0);
});