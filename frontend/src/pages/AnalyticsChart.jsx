import React from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

export default function AnalyticsChart({ data }) {
  const labels = Object.keys(data || {})
  const values = labels.map(l => data[l] || 0)
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Threat counts',
        data: values,
        backgroundColor: 'rgba(99,102,241,0.8)'
      }
    ]
  }
  return (
    <div>
      <Bar data={chartData} />
    </div>
  )
}
