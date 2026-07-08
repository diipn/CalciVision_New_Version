import { useState } from "react"

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function Calendar() {
    const [date, setDate] = useState(new Date())
    const todayDate = new Date()

    const currentMonthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const previousMonthDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate()
    const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    const monthWeeks = Math.ceil((firstWeekday + currentMonthDays) / 7)
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getFullYear()

    const getDayInfo = (week, weekday) => {
        const day = week * 7 + weekday - firstWeekday + 1

        if (week === 0 && weekday < firstWeekday) {
            const dayNum = previousMonthDays - (firstWeekday - weekday) + 1
            const prevDate = new Date(date.getFullYear(), date.getMonth() - 1, dayNum)
            return {
                day: dayNum,
                currentMonth: false,
                fullDate: prevDate
            }
        }

        if (day > currentMonthDays) {
            const dayNum = day - currentMonthDays
            const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, dayNum)
            return {
                day: dayNum,
                currentMonth: false,
                fullDate: nextDate
            }
        }

        const currentDate = new Date(date.getFullYear(), date.getMonth(), day)
        return {
            day,
            currentMonth: true,
            fullDate: currentDate
        }
    }

    const nextMonth = () => {
        setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))
    }

    const previousMonth = () => {
        setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))
    }

    return (
        <div className="border-2 border-gray-medium rounded-lg">
            <div className="flex items-center px-6 py-3 border-b-2 border-gray-medium">
                <p className="text-lg font-medium capitalize">
                    <span>{month}</span>, <span>{year}</span>
                </p>
                <div className="ml-auto flex gap-1">
                    <button
                        onClick={previousMonth}
                        className="w-5 h-5 grid place-items-center text-white rounded-full p-1 bg-gray-medium"
                        role="button"
                    >
                        {/* Ícone esquerda */}
                        <svg viewBox="0 0 24 24" fill="none"><path d="M15.7 4.3c.4.4.4 1 0 1.4L9.4 12l6.3 6.3a1 1 0 01-1.4 1.4L7.3 12.7a1 1 0 010-1.4l7-7a1 1 0 011.4 0z" fill="#fff"/></svg>
                    </button>
                    <button
                        onClick={nextMonth}
                        className="w-5 h-5 grid place-items-center text-white rounded-full p-1 bg-gray-medium"
                        role="button"
                    >
                        {/* Ícone direita */}
                        <svg viewBox="0 0 24 24" fill="none"><path d="M8.3 19.7a1 1 0 010-1.4L14.6 12 8.3 5.7a1 1 0 011.4-1.4l7 7a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0z" fill="#fff"/></svg>
                    </button>
                </div>
            </div>
            <div className="p-6">
                <ul className="grid grid-cols-7 mb-4">
                    {weekdays.map((day, index) =>
                        <li
                            key={index}
                            className="text-center text-green-dark font-semibold"
                        >
                            {day}
                        </li>
                    )}
                </ul>
                <div className="flex flex-col">
                    {Array.from({ length: monthWeeks }).map((_, weekIndex) =>
                        <ul key={weekIndex} className="grid grid-cols-7 h-10">
                            {Array.from({ length: 7 }).map((_, weekdayIndex) => {
                                const { day, currentMonth, fullDate } = getDayInfo(weekIndex, weekdayIndex)
                                const isToday =
                                    fullDate.getDate() === todayDate.getDate() &&
                                    fullDate.getMonth() === todayDate.getMonth() &&
                                    fullDate.getFullYear() === todayDate.getFullYear()

                                return (
                                    <Day
                                        key={weekdayIndex}
                                        number={day}
                                        today={isToday}
                                        currentMonth={currentMonth}
                                    />
                                )
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}

function Day({ number, today, currentMonth }) {
    return (
        <li className={`grid place-items-center relative ${currentMonth ? 'text-gray-dark' : 'text-gray-medium'} ${today ? 'text-white' : 'text-current'}`}>
            <span className="z-10">{number}</span>
            {today && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 aspect-square rounded-full bg-green -z-1" />}
        </li>
    )
}

export default Calendar
