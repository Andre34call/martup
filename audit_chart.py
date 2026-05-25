import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# ── Data ──
categories = [
    'Backend API\n(39 Routes)',
    'Security\n(Auth & Auth)',
    'Database\nSchema',
    'Frontend\nScreens',
    'Payment\nIntegration',
    'Real-time\nFeatures',
    'Data\nIntegrity',
    'Production\nReadiness'
]

scores = [72, 55, 45, 60, 25, 20, 35, 40]
colors_fill = []
for s in scores:
    if s >= 70:
        colors_fill.append('#22C55E')  # green
    elif s >= 50:
        colors_fill.append('#F59E0B')  # amber
    else:
        colors_fill.append('#EF4444')  # red

# ── Figure Setup ──
fig, ax = plt.subplots(figsize=(14, 7))
fig.patch.set_facecolor('#FAFAFA')
ax.set_facecolor('#FAFAFA')

x = np.arange(len(categories))
bar_width = 0.6

# Background bars (100%)
ax.bar(x, [100]*len(x), width=bar_width, color='#E5E7EB', zorder=1)

# Score bars
bars = ax.bar(x, scores, width=bar_width, color=colors_fill, alpha=0.85, zorder=2,
              edgecolor='white', linewidth=1.5)

# Score labels on bars
for i, (bar, score) in enumerate(zip(bars, scores)):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 2,
            f'{score}%', ha='center', va='bottom',
            fontsize=15, fontweight='bold', color='#1F2937')

# Category labels
ax.set_xticks(x)
ax.set_xticklabels(categories, fontsize=11, color='#374151', fontweight='medium')

# Y-axis
ax.set_ylim(0, 110)
ax.set_yticks([0, 25, 50, 75, 100])
ax.set_yticklabels(['0%', '25%', '50%', '75%', '100%'], fontsize=10, color='#6B7280')
ax.set_ylabel('Readiness Score', fontsize=12, color='#374151', fontweight='medium')

# Title
ax.set_title('MartUp Launch Readiness Audit — Per Category',
             fontsize=18, fontweight='bold', color='#111827', pad=20)

# Grid
ax.yaxis.grid(True, alpha=0.15, color='#9CA3AF')
ax.set_axisbelow(True)

# Spines
for spine in ['top', 'right']:
    ax.spines[spine].set_visible(False)
ax.spines['left'].set_color('#D1D5DB')
ax.spines['bottom'].set_color('#D1D5DB')

# Legend
legend_patches = [
    mpatches.Patch(color='#22C55E', alpha=0.85, label='≥70% Ready'),
    mpatches.Patch(color='#F59E0B', alpha=0.85, label='50-69% Needs Work'),
    mpatches.Patch(color='#EF4444', alpha=0.85, label='<50% Critical'),
]
ax.legend(handles=legend_patches, loc='upper right', frameon=False, fontsize=10)

# Overall score
overall = int(np.mean(scores))
fig.text(0.5, 0.02, f'Overall Launch Readiness: {overall}%  |  Target: 90%+  |  Gap: {90-overall}%',
         ha='center', fontsize=14, fontweight='bold',
         color='#EF4444' if overall < 50 else '#F59E0B' if overall < 70 else '#22C55E',
         bbox=dict(boxstyle='round,pad=0.5', facecolor='white', edgecolor='#D1D5DB', alpha=0.9))

plt.tight_layout()
plt.subplots_adjust(bottom=0.12)
plt.savefig('/home/z/my-project/audit_readiness.png', dpi=200, bbox_inches='tight',
            facecolor='#FAFAFA', edgecolor='none')
print("Chart saved!")
