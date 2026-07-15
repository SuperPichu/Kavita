using Kavita.API.Repositories;
using Kavita.Models.Entities.Metadata;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
namespace Kavita.Database.Repositories;



public class SeriesMetadataRepository(DataContext context) : ISeriesMetadataRepository
{
    public void Update(SeriesMetadata seriesMetadata)
    {
        context.SeriesMetadata.Update(seriesMetadata);
    }

    public async Task<bool> FindByUrl(string url)
    {
        SeriesMetadata existing = await context.SeriesMetadata.FirstOrDefaultAsync(sm => sm.WebLinks.Contains(url));
        return existing != null;
    }
}
