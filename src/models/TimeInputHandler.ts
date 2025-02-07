export class TimeInputHandler {
    private static timePatterns = {
      // 14:30, 14.30, 14,30
      separated: /^(\d{1,2})[:.,](\d{2})$/,
      // 1430
      continuous: /^(\d{1,2})(\d{2})$/,
      // 14 30
      spaced: /^(\d{1,2})\s+(\d{2})$/
    };
  

    public static parseTimeInput(input: string): {
      isValid: boolean;
      hour: number;
      minute: number;
      errorMessage?: string;
    } {
      const cleanInput = input.toLowerCase().trim();
  
      for (const [, pattern] of Object.entries(this.timePatterns)) {
        const match = cleanInput.match(pattern);
        if (match) {
          const hour = parseInt(match[1], 10);
          const minute = parseInt(match[2], 10);
          if (hour < 0 || hour > 23) {
            return {
              isValid: false,
              hour: 0,
              minute: 0,
              errorMessage: 'Часы должны быть от 0 до 23'
            };
          }
          
          if (minute < 0 || minute > 59) {
            return {
              isValid: false,
              hour: 0,
              minute: 0,
              errorMessage: 'Минуты должны быть от 0 до 59'
            };
          }
  
          return {
            isValid: true,
            hour,
            minute
          };
        }
      }
  
      return {
        isValid: false,
        hour: 0,
        minute: 0,
        errorMessage: 'Неверный формат времени. Используйте формат ЧЧ:ММ, ЧЧ.ММ, ЧЧ ММ или ЧЧММ'
      };
    }
  }