// ========================================
// SELECTOR GLOBAL DE PERÍODOS ACADÉMICOS
// Para incluir en todas las páginas del sistema
// ========================================

// Helper para realizar peticiones autenticadas usando el token
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('sessionToken');

    const defaultOptions = {
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
        }
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };

    const response = await fetch(url, mergedOptions);

    if (response.status === 401) {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('teacherInfo');
        window.location.href = '/login.html';
        return Promise.reject(new Error('Unauthorized'));
    }

    return response;
}

class GlobalPeriodSelector {
    constructor() {
        this.currentPeriod = this.loadCurrentPeriod();
        this.schools = [];
        this.availablePeriods = [];
        this.isInitialized = false;
    }

    async init() {
        try {
            await this.loadSchools();
            await this.loadAvailablePeriods();
            this.setupEventListeners();
            this.updateUI();
            this.isInitialized = true;
            console.log('✅ Selector global de períodos inicializado');
        } catch (error) {
            console.error('❌ Error inicializando selector global:', error);
        }
    }

    // ========================================
    // CARGA DE DATOS DESDE API
    // ========================================

    async loadSchools() {
    try {
        const response = await fetch('/api/schools');
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            this.schools = result.data;
            console.log('✅ Escuelas cargadas:', this.schools.length);
        } else {
            throw new Error('No se encontraron escuelas');
        }
    } catch (error) {
        console.error('❌ Error cargando escuelas:', error);
        // CORRECCIÓN: Asegurar que siempre haya al menos una escuela
        this.schools = [
            { id: 1, name: 'Mi Escuela Principal' }
        ];
        
        // Crear escuela por defecto si no existe
        try {
            await fetch('/api/schools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Mi Escuela Principal',
                    address: 'Dirección de la Escuela',
                    phone: '0000-0000',
                    email: 'contacto@miescuela.cr'
                })
            });
        } catch (createError) {
            console.log('Escuela por defecto ya existe');
        }
    }
}

    async loadAvailablePeriods() {
        try {
            const response = await fetch('/api/academic-periods');
            const result = await response.json();
            
            if (result.success) {
                this.availablePeriods = result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error cargando períodos:', error);
            this.availablePeriods = [];
        }
    }

    async getCurrentPeriodFromAPI() {
        try {
            const response = await fetch('/api/academic-periods/current');
            const result = await response.json();
            
            if (result.success) {
                return {
                    schoolId: '1',
                    year: result.data.year,
                    periodType: result.data.period_type,
                    periodNumber: result.data.period_number,
                    periodId: result.data.id
                };
            }
        } catch (error) {
            console.error('Error obteniendo período actual de API:', error);
        }
        
        return null;
    }

    // ========================================
    // EVENTOS Y LISTENERS
    // ========================================

    setupEventListeners() {
        // Cambio de tipo de período (semestre/trimestre)
        const periodTypeSelector = document.getElementById('periodTypeSelector');
        if (periodTypeSelector) {
            periodTypeSelector.addEventListener('change', (e) => {
                this.updatePeriodOptions(e.target.value);
            });
        }

        // Cambio de año
        const yearSelector = document.getElementById('yearSelector');
        if (yearSelector) {
            yearSelector.addEventListener('change', () => {
                this.loadAvailablePeriods();
            });
        }

        // Botón aplicar
        const applyBtn = document.getElementById('applyPeriodBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyPeriodChange();
            });
        }

        // Marcar cambios en cualquier selector
        ['schoolSelector', 'yearSelector', 'periodTypeSelector', 'periodSelector'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.markAsChanged();
                });
            }
        });

        // Escuchar cambios globales de período
        window.addEventListener('academicPeriodChanged', (event) => {
            this.onPeriodChanged(event.detail);
        });
    }

    // ========================================
    // ACTUALIZACIÓN DE UI
    // ========================================

    updatePeriodOptions(periodType) {
        const periodSelector = document.getElementById('periodSelector');
        if (!periodSelector) return;

        periodSelector.innerHTML = '';

        if (periodType === 'semester') {
            periodSelector.innerHTML = `
                <option value="1">Primer Semestre</option>
                <option value="2">Segundo Semestre</option>
            `;
        } else if (periodType === 'trimester') {
            periodSelector.innerHTML = `
                <option value="1">Primer Trimestre</option>
                <option value="2">Segundo Trimestre</option>
                <option value="3">Tercer Trimestre</option>
            `;
        }
    }

    updateSchoolOptions() {
        const schoolSelector = document.getElementById('schoolSelector');
        if (!schoolSelector) return;

        schoolSelector.innerHTML = '';
        
        // Agregar escuelas existentes
        this.schools.forEach(school => {
            const option = document.createElement('option');
            option.value = school.id;
            option.textContent = school.name;
            schoolSelector.appendChild(option);
        });

        // Agregar opciones para agregar más escuelas (máximo 3)
        const schoolCount = this.schools.length;
        if (schoolCount < 3) {
            for (let i = schoolCount + 1; i <= 3; i++) {
                const option = document.createElement('option');
                option.value = `add_${i}`;
                option.textContent = `+ Agregar ${i === 2 ? 'Segunda' : 'Tercera'} Escuela`;
                option.disabled = true;
                schoolSelector.appendChild(option);
            }
        }
    }

    updateUI() {
        if (!this.currentPeriod) return;

        // Actualizar selectores de escuelas
        this.updateSchoolOptions();

        // Actualizar selectores con período actual
        const schoolSelector = document.getElementById('schoolSelector');
        const yearSelector = document.getElementById('yearSelector');
        const periodTypeSelector = document.getElementById('periodTypeSelector');
        const periodSelector = document.getElementById('periodSelector');

        if (schoolSelector) schoolSelector.value = this.currentPeriod.schoolId;
        if (yearSelector) yearSelector.value = this.currentPeriod.year;
        if (periodTypeSelector) periodTypeSelector.value = this.currentPeriod.periodType;
        
        this.updatePeriodOptions(this.currentPeriod.periodType);
        if (periodSelector) periodSelector.value = this.currentPeriod.periodNumber;
        
        this.updateCurrentPeriodIndicator();
    }

    updateCurrentPeriodIndicator() {
        const indicator = document.getElementById('currentPeriodText');
        if (!indicator) return;

        const schoolName = this.getSchoolName(this.currentPeriod.schoolId);
        const periodTypeName = this.currentPeriod.periodType === 'semester' ? 'Semestre' : 'Trimestre';
        const periodNumber = this.getPeriodNumberName(this.currentPeriod.periodNumber);
        
        indicator.textContent = `${this.currentPeriod.year} - ${periodNumber} ${periodTypeName} - ${schoolName}`;
    }

    // ========================================
    // APLICACIÓN DE CAMBIOS
    // ========================================

    markAsChanged() {
        const applyBtn = document.getElementById('applyPeriodBtn');
        if (applyBtn) {
            applyBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            applyBtn.innerHTML = '<i class="fas fa-exclamation"></i> Cambios Pendientes';
            applyBtn.classList.add('changed');
        }
    }

async applyPeriodChange() {
    const schoolSelector = document.getElementById('schoolSelector');
    const yearSelector = document.getElementById('yearSelector');
    const periodTypeSelector = document.getElementById('periodTypeSelector');
    const periodSelector = document.getElementById('periodSelector');

    if (!schoolSelector || !yearSelector || !periodTypeSelector || !periodSelector) {
        console.error('No se encontraron los selectores necesarios');
        return;
    }

    // Protección contra múltiples clicks
    const applyBtn = document.getElementById('applyPeriodBtn');
    if (applyBtn && applyBtn.disabled) {
        console.log('⚠️ Cambio de período ya en progreso, ignorando click adicional');
        return;
    }

    const newPeriod = {
        schoolId: schoolSelector.value,
        year: parseInt(yearSelector.value),
        periodType: periodTypeSelector.value,
        periodNumber: parseInt(periodSelector.value)
    };

    console.log('📅 Cambiando a período:', newPeriod);

    try {
        // Mostrar estado de carga
        this.setLoadingState(true);

        // Obtener período actual para comparación
        const currentPeriod = this.loadCurrentPeriod();
        
        // Establecer nuevo período en servidor
        const response = await fetch('/api/academic-periods/set-current', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                year: newPeriod.year,
                period_type: newPeriod.periodType,
                period_number: newPeriod.periodNumber
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Período establecido en servidor:', result.data);

            // VERIFICAR SI EL NUEVO PERÍODO ESTÁ VACÍO Y OFRECER COPIA
            try {
                const checkStudentsResponse = await authenticatedFetch(`/api/students?year=${newPeriod.year}&period_type=${newPeriod.periodType}&period_number=${newPeriod.periodNumber}`);
                const checkResult = await checkStudentsResponse.json();
                
                if (checkResult.success && checkResult.data.length === 0) {
                    console.log('📝 Período nuevo sin estudiantes detectado');
                    
                    // Solo ofrecer copia si hay un período anterior diferente
                    const isDifferentPeriod = currentPeriod.year && (
                        currentPeriod.year !== newPeriod.year || 
                        currentPeriod.periodType !== newPeriod.periodType ||
                        currentPeriod.periodNumber !== newPeriod.periodNumber
                    );
                    
                    if (isDifferentPeriod) {
                        // Construir mensaje descriptivo
                        const periodTypeName = newPeriod.periodType === 'semester' ? 'Semestre' : 'Trimestre';
                        const periodNumber = newPeriod.periodNumber === 1 ? 'Primer' : 
                                           newPeriod.periodNumber === 2 ? 'Segundo' : 'Tercer';
                        
                        const confirmCopy = confirm(
                            `El ${periodNumber} ${periodTypeName} ${newPeriod.year} está vacío.\n\n` +
                            `¿Deseas copiar la lista de estudiantes del período anterior como base?\n\n` +
                            `📋 Esto copiará solo la información básica de los estudiantes\n` +
                            `📚 Cada período mantendrá sus datos completamente independientes\n` +
                            `✅ Los cambios en un período NO afectarán al otro\n\n` +
                            `¿Continuar con la copia?`
                        );
                        
                        if (confirmCopy) {
                            try {
                                console.log('🔄 Iniciando copia de estudiantes...');
                                
                                // Determinar período de origen (el anterior al actual)
                                let fromPeriodId = 1; // Fallback
                                
                                if (currentPeriod.periodId) {
                                    fromPeriodId = currentPeriod.periodId;
                                }
                                
                                const copyResponse = await authenticatedFetch('/api/students/copy-period', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        fromPeriodId: fromPeriodId,
                                        toPeriodId: result.data.periodId
                                    })
                                });
                                
                                const copyResult = await copyResponse.json();
                                
                                if (copyResult.success && !copyResult.data.skipped) {
                                    console.log(`✅ ${copyResult.data.copied} estudiantes copiados`);
                                    
                                    // Mostrar mensaje de éxito más detallado
                                    setTimeout(() => {
                                        alert(
                                            `✅ Copia completada exitosamente\n\n` +
                                            `📊 ${copyResult.data.copied} estudiantes copiados al ${periodNumber} ${periodTypeName}\n\n` +
                                            `📝 Recordatorio: Cada período es independiente\n` +
                                            `🔄 Recarga la página de estudiantes para ver los datos`
                                        );
                                    }, 1000);
                                    
                                } else if (copyResult.data && copyResult.data.skipped) {
                                    console.log('ℹ️ Copia omitida:', copyResult.data.message);
                                    alert('ℹ️ ' + copyResult.data.message);
                                } else {
                                    throw new Error(copyResult.message || 'Error en la copia');
                                }
                                
                            } catch (copyError) {
                                console.error('❌ Error en copia de estudiantes:', copyError);
                                alert(`⚠️ Error copiando estudiantes: ${copyError.message}\n\nEl período se cambió correctamente, pero no se pudieron copiar los estudiantes.`);
                            }
                        } else {
                            console.log('👤 Usuario eligió no copiar estudiantes');
                        }
                    }
                } else if (checkResult.success && checkResult.data.length > 0) {
                    console.log(`✅ Período ya tiene ${checkResult.data.length} estudiantes`);
                }
                
            } catch (checkError) {
                console.log('ℹ️ No se pudo verificar estudiantes para copia automática:', checkError.message);
            }

            // ========================================
            // ACTUALIZAR ESTADO INTERNO
            // ========================================

            // Guardar período con ID en localStorage
            const periodToSave = {
                ...newPeriod,
                periodId: result.data.periodId
            };
            
            this.saveCurrentPeriod(periodToSave);
            
            // Actualizar estado interno
            this.currentPeriod = periodToSave;
            
            // Actualizar indicador visual
            this.updateCurrentPeriodIndicator();
            
            // Mostrar estado de éxito
            this.setSuccessState();
            
            // Enviar evento global para que otros módulos recarguen sus datos
            this.broadcastPeriodChange(periodToSave);
            
            console.log('📅 Cambio de período completado exitosamente');
            
        } else {
            throw new Error(result.message || 'Error estableciendo período en servidor');
        }
        
    } catch (error) {
        console.error('❌ Error aplicando cambio de período:', error);
        this.setErrorState(error.message);
        
        // Mostrar mensaje de error al usuario
        alert(`❌ Error cambiando período: ${error.message}`);
    }
}

    // ========================================
    // FUNCIÓN AUXILIAR PARA RECARGAR DATOS DEL MÓDULO ACTUAL
    // ========================================

    async reloadCurrentModuleData(newPeriod) {
        try {
            // Detectar en qué página/módulo estamos
            const currentPath = window.location.pathname;
            
            console.log('🔄 Recargando datos del módulo actual para período:', newPeriod);

            // Recargar datos según el módulo actual
            if (currentPath.includes('students.html')) {
                // Recargar lista de estudiantes
                if (typeof loadStudents === 'function') {
                    await loadStudents();
                }
                if (typeof loadGradesAndSubjects === 'function') {
                    await loadGradesAndSubjects();
                }
            } 
            else if (currentPath.includes('attendance.html')) {
                // Recargar datos de asistencia
                if (typeof loadAttendanceData === 'function') {
                    await loadAttendanceData();
                }
            }
            else if (currentPath.includes('dashboard.html')) {
                // Recargar dashboard
                if (typeof loadDashboardData === 'function') {
                    await loadDashboardData();
                }
            }
            else if (currentPath.includes('cotidiano.html')) {
                // Recargar datos cotidianos
                if (typeof loadDailyData === 'function') {
                    await loadDailyData();
                }
            }

            console.log('✅ Datos del módulo recargados correctamente');
            
        } catch (error) {
            console.warn('⚠️ Error recargando datos del módulo (no crítico):', error.message);
        }
    }

    // ========================================
    // ESTADOS DEL BOTÓN
    // ========================================

    setLoadingState(loading) {
        const applyBtn = document.getElementById('applyPeriodBtn');
        if (!applyBtn) return;

        if (loading) {
            applyBtn.disabled = true;
            applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aplicando...';
            applyBtn.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
        } else {
            applyBtn.disabled = false;
        }
    }

    setSuccessState() {
        const applyBtn = document.getElementById('applyPeriodBtn');
        if (!applyBtn) return;

        applyBtn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
        applyBtn.innerHTML = '<i class="fas fa-check"></i> Aplicado';
        applyBtn.classList.remove('changed');

        setTimeout(() => {
            applyBtn.innerHTML = '<i class="fas fa-check"></i> Aplicar';
        }, 2000);
    }

    setErrorState(message) {
        const applyBtn = document.getElementById('applyPeriodBtn');
        if (!applyBtn) return;

        applyBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        applyBtn.innerHTML = '<i class="fas fa-times"></i> Error';

        setTimeout(() => {
            applyBtn.innerHTML = '<i class="fas fa-check"></i> Aplicar';
            applyBtn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
        }, 3000);

        console.error('Error en selector de período:', message);
    }

    // ========================================
    // PERSISTENCIA Y COMUNICACIÓN
    // ========================================

    loadCurrentPeriod() {
        const saved = localStorage.getItem('currentAcademicPeriod');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                console.error('Error parseando período guardado:', error);
            }
        }
        
        // Período por defecto
        return {
            schoolId: '1',
            year: 2025,
            periodType: 'semester',
            periodNumber: 1
        };
    }

    saveCurrentPeriod(period) {
        localStorage.setItem('currentAcademicPeriod', JSON.stringify(period));
    }

    broadcastPeriodChange(newPeriod) {
        // Enviar evento personalizado para que otros componentes escuchen
        window.dispatchEvent(new CustomEvent('academicPeriodChanged', {
            detail: newPeriod
        }));
    }

    onPeriodChanged(newPeriod) {
        console.log('📅 Período académico cambiado:', newPeriod);
        // Aquí se pueden ejecutar acciones adicionales cuando cambie el período
    }

    // ========================================
    // MÉTODOS UTILITARIOS
    // ========================================

    getSchoolName(schoolId) {
        const school = this.schools.find(s => s.id == schoolId);
        if (school) {
            return school.name;
        }

        // Fallback: usar la escuela del profesor si está disponible
        const data = sessionStorage.getItem('teacherData');
        if (data) {
            try {
                const teacher = JSON.parse(data);
                return teacher.school || teacher.school_name || 'Escuela Desconocida';
            } catch (error) {
                console.warn('Error parseando teacherData:', error);
            }
        }

        return 'Escuela Desconocida';
    }

    getPeriodNumberName(periodNumber) {
        const names = {
            1: 'Primer',
            2: 'Segundo', 
            3: 'Tercer'
        };
        return names[periodNumber] || `${periodNumber}°`;
    }

    // ========================================
    // MÉTODOS PÚBLICOS
    // ========================================

    getCurrentPeriod() {
        return this.currentPeriod;
    }

    async refreshPeriods() {
        await this.loadAvailablePeriods();
        this.updateUI();
    }

    async refreshSchools() {
        await this.loadSchools();
        this.updateSchoolOptions();
    }
}

// ========================================
// FUNCIONES GLOBALES
// ========================================

// Variable global para acceder al selector
window.globalPeriodSelector = null;

// Función para inicializar el selector (llamar en cada página)
window.initGlobalPeriodSelector = function() {
    if (!window.globalPeriodSelector) {
        window.globalPeriodSelector = new GlobalPeriodSelector();
    }
    return window.globalPeriodSelector.init();
};

// Función global para obtener período actual (para usar en otras páginas)
window.getCurrentAcademicPeriod = function() {
    if (window.globalPeriodSelector) {
        return window.globalPeriodSelector.getCurrentPeriod();
    }
    
    // Fallback: leer de localStorage
    const saved = localStorage.getItem('currentAcademicPeriod');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error parseando período de localStorage:', error);
        }
    }
    
    // Período por defecto
    return {
        schoolId: '1',
        year: 2025,
        periodType: 'semester',
        periodNumber: 1
    };
};

// Función para forzar recarga de datos basado en período actual
window.reloadCurrentPeriodData = function() {
    const currentPeriod = window.getCurrentAcademicPeriod();
    console.log('🔄 Recargando datos para período:', currentPeriod);
    
    // Enviar evento para que los módulos recarguen sus datos
    window.dispatchEvent(new CustomEvent('reloadPeriodData', {
        detail: currentPeriod
    }));
};

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Solo inicializar si existe el contenedor del selector
    if (document.getElementById('schoolSelector') || 
        document.querySelector('.global-selector-container')) {
        window.initGlobalPeriodSelector();
    }
});

console.log('📅 Script del selector global de períodos cargado');